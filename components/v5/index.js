import React from "react";
import Panel from "./panel";
import FilesTab from "./files-tab";
import { fetchPullRequest } from "./utils";
import { mountAboveSidebar } from "../page";
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

const SIDEBAR_ID = "pullapprove-v5-sidebar";

// How stale a visible tab's answer may get before it's fetched again.
const POLL_MS = 15 * 1000;

// How long after GitHub's state label changes to fetch again, by which point
// PullApprove has usually processed the webhook (a few seconds in practice).
const REFETCH_AFTER_STATE_CHANGE_MS = 6 * 1000;

// One PR at a time: its latest fetch, the last state label shown, the
// sidebar React root, the files tab UI, and which fetch they're showing.
const EMPTY = {
  key: null,
  page: null,
  promise: null,
  fetchedAt: 0,
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
  }
});

export function unmountV5() {
  current.root?.unmount();
  document.getElementById(SIDEBAR_ID)?.remove();
  current.filesTab?.remove();
  current = { ...EMPTY };
}

export async function mountV5(page) {
  const key = `${page.org}/${page.repo}/${page.number}`;
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
  } else if (Date.now() - current.fetchedAt > POLL_MS) {
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

// A refetch that fails for a passing reason (a laptop waking up, a
// PullApprove deploy) keeps showing the last answer rather than blanking it.
function fetchLatest() {
  const previous = current.promise;
  current.fetchedAt = Date.now();
  current.promise = fetchPullRequest(current.page).then((response) => {
    const transient = response.status === 0 || response.status >= 500;
    if (transient && previous) {
      return previous;
    }
    return response;
  });
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
  current.root = mountAboveSidebar(SIDEBAR_ID, <Panel response={response} />);
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
