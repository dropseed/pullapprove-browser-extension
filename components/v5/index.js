import React from "react";
import Panel from "./panel";
import FilesTab from "./files-tab";
import { fetchPullRequest } from "./utils";
import { mountAtTopOfSidebar } from "../page";
import { pullRequestStateLabel } from "../github";

// PullApprove 5: the PR is looked up on PullApprove by org/repo/number (via
// the service worker, with this browser's extension token), then rendered
// as a sidebar panel and, on the files tab, as marks on your files plus an
// "only files in my scopes" filter.
//
// PullApprove is the one that knows when its answer changes, so while the tab
// is visible the lookup is repeated every POLL_MS, and whatever came back last
// is rendered. A hidden tab doesn't poll (an open tab nobody is looking at
// costs nothing) and catches up within a second of being looked at again.
// The one change worth not waiting for is GitHub's state label (draft, ready,
// merged, closed), which refetches right away.
//
// A 4xx answer rarely changes in the next POLL_MS: a 404 is a PR
// PullApprove doesn't have or the viewer can't see, a 403 one the sidebar
// can only explain, and the rest (a dropped token, an outdated build, rate
// limiting) are no better asked again soon. So each 4xx in a row doubles the
// wait, up to MAX_POLL_MS. A tab left open on one asks a few times an hour
// instead of four times a minute, and a PR opened moments ago, before
// PullApprove has processed it, is asked about again 30 seconds later, then
// a minute after that.
//
// A merged or closed PR's answer rarely changes either, so its tab asks
// every MAX_POLL_MS too. Reopening it changes the state label, which
// refetches right away as above.

const SIDEBAR_ID = "pullapprove-v5-sidebar";

// How stale a visible tab's answer may get before it's fetched again.
const POLL_MS = 15 * 1000;
const MAX_POLL_MS = 10 * 60 * 1000;

// GitHub's state labels for a pull request that's done.
const DONE_STATES = ["Merged", "Closed"];

// How long after GitHub's state label changes to fetch again, by which point
// PullApprove has usually processed the webhook (a few seconds in practice).
const REFETCH_AFTER_STATE_CHANGE_MS = 6 * 1000;

// One PR at a time: its latest fetch, how many 4xx answers in a row came
// back and the last one's status, the last state label shown, the sidebar
// React root, the files tab UI, and which fetch they're showing.
const EMPTY = {
  key: null,
  page: null,
  promise: null,
  fetchedAt: 0,
  misses: 0,
  missStatus: 0,
  lastState: "",
  root: null,
  filesTab: null,
  renderedPromise: null,
  renderedJson: null,
};
let current = { ...EMPTY };

// Connecting or disconnecting changes what PullApprove will answer, so the
// next sync of a visible tab (within a second) fetches a new one. The last
// answer stays up until it arrives; a hidden tab catches up when looked at.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.token) {
    current.fetchedAt = 0;
    current.misses = 0;
    current.missStatus = 0;
  }
});

// A 403 is usually fixed in another tab or window (finishing single sign-on,
// reconnecting GitHub), so a tab backing off from one catches up as soon as
// it's looked at again: shown again, or its window focused again (a window
// beside the other one never stops being visible).
function catchUpAfter403() {
  if (!document.hidden && current.missStatus === 403) {
    current.fetchedAt = 0;
  }
}
document.addEventListener("visibilitychange", catchUpAfter403);
window.addEventListener("focus", catchUpAfter403);

export function unmountV5() {
  current.root?.unmount();
  document.getElementById(SIDEBAR_ID)?.remove();
  current.filesTab?.remove();
  current = { ...EMPTY };
}

export async function mountV5(page) {
  const key = page.key;
  if (current.key !== key) {
    unmountV5();
    current.key = key;
  }
  current.page = page;
  const stateChanged = stateLabelChanged();
  if (!current.promise) {
    fetchLatest();
  } else if (document.hidden) {
    // Nobody is looking; the poll below catches up once somebody is.
  } else if (stateChanged) {
    // GitHub shows the change before PullApprove has processed it. Fetch now
    // for the parts that don't wait on PullApprove, and again once it has
    // likely caught up, rather than waiting out the poll.
    fetchLatest();
    setTimeout(() => {
      if (current.key === key) {
        fetchLatest();
      }
    }, REFETCH_AFTER_STATE_CHANGE_MS);
  } else if (Date.now() - current.fetchedAt > pollInterval()) {
    fetchLatest();
  }

  const promise = current.promise;
  const response = await promise;
  if (current.key !== key || current.promise !== promise) {
    // Navigated to another PR, or refetched, while this was in flight.
    return;
  }

  // A new answer: render it everywhere. Otherwise just put back whatever
  // GitHub's navigation tore down.
  if (promise !== current.renderedPromise) {
    current.renderedPromise = promise;
    if (response.status === 0) {
      console.warn("PullApprove: could not reach PullApprove", response.error);
    }
    const json = JSON.stringify(response);
    if (json !== current.renderedJson) {
      current.renderedJson = json;
      current.root?.render(<Panel response={response} />);
      current.filesTab?.remove();
      current.filesTab = null;
    }
  }
  renderSidebar(response);
  // current.page, not `page`: the tab may have changed during the fetch.
  renderFilesTab(current.page, response);
}

function pollInterval() {
  if (DONE_STATES.includes(current.lastState)) {
    return MAX_POLL_MS;
  }
  return Math.min(POLL_MS * 2 ** current.misses, MAX_POLL_MS);
}

// A refetch that fails for a passing reason (a laptop waking up, a
// PullApprove deploy) keeps showing the last answer rather than blanking it,
// and doesn't count toward backing off.
function fetchLatest() {
  // This PR's state, which navigating away replaces before the answer lands.
  const pr = current;
  const previous = pr.promise;
  pr.fetchedAt = Date.now();
  const promise = fetchPullRequest(pr.page).then((response) => {
    if (response.status === 0 || response.status >= 500) {
      return previous || response;
    }
    // Only the latest request's answer counts toward backing off, not one a
    // newer request has replaced.
    if (pr.promise === promise) {
      const miss = response.status >= 400;
      pr.misses = miss ? pr.misses + 1 : 0;
      pr.missStatus = miss ? response.status : 0;
    }
    return response;
  });
  pr.promise = promise;
}

// The label counts as changed only when it goes from one shown value to
// another. Appearing or disappearing while GitHub renders isn't a change, so
// the last value shown is what the next one is compared to.
function stateLabelChanged() {
  const state = pullRequestStateLabel();
  const changed = Boolean(
    current.lastState && state && current.lastState !== state
  );
  current.lastState = state || current.lastState;
  return changed;
}

function renderSidebar(response) {
  if (document.getElementById(SIDEBAR_ID)) {
    return;
  }
  current.root?.unmount();
  current.root = mountAtTopOfSidebar(SIDEBAR_ID, <Panel response={response} />);
}

// The files tab UI lives only while the files tab is showing: it's torn down
// on the way to another tab and rebuilt on the way back (and after a new
// answer, above). GitHub serves the tab at /files and redirects to /changes.
function renderFilesTab(page, response) {
  const onFilesTab = ["files", "changes"].includes(page.tab);
  if (!onFilesTab) {
    current.filesTab?.remove();
    current.filesTab = null;
  } else if (!current.filesTab && response.status === 200) {
    current.filesTab = new FilesTab(response.data);
  }
}
