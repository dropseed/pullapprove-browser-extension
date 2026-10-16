import React from "react";
import Panel from "./panel";
import FilesTab from "./files-tab";
import { fetchPullRequest } from "./utils";
import { mountAboveSidebar } from "../page";
import { pullRequestSignals } from "../github";

// PullApprove 5: the PR is looked up on PullApprove by org/repo/number (via
// the service worker, with the viewer's PullApprove session), then rendered
// as a sidebar panel and, on the files tab, as marks on your files plus an
// "only files in my scopes" filter.
//
// The lookup is repeated when the page shows the PR changed (GitHub's state
// label or PullApprove's status row, both updated live) and when the tab
// comes back into view, and whatever came back last is rendered. There is
// no timer: an open tab nobody is looking at costs nothing.

const SIDEBAR_ID = "pullapprove-v5-sidebar";

// Coming back to a tab refetches only if the last fetch is older than this,
// so flipping between windows doesn't fetch on every flip.
const REFRESH_ON_FOCUS_AFTER_MS = 10 * 1000;

// One PR at a time: its latest fetch, the last value each page signal
// showed, the sidebar React root, the files tab UI, and which fetch they're
// showing.
const EMPTY = {
  key: null,
  page: null,
  promise: null,
  fetchedAt: 0,
  lastState: "",
  lastStatuses: "",
  root: null,
  filesTab: null,
  renderedPromise: null,
  renderedJson: null,
};
let current = { ...EMPTY };

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
  const changed = signalsChanged();
  if (!current.promise || changed) {
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
  renderFilesTab(page, response);
}

// The tab came back into view: refetch if what's showing may be stale.
export function refreshV5() {
  if (
    current.key &&
    Date.now() - current.fetchedAt > REFRESH_ON_FOCUS_AFTER_MS
  ) {
    fetchLatest();
  }
}

// A refetch that can't reach PullApprove (a laptop waking up, say) keeps
// showing the last answer rather than blanking it.
function fetchLatest() {
  const previous = current.promise;
  current.fetchedAt = Date.now();
  current.promise = fetchPullRequest(current.page).then((response) => {
    if (response.status === 0 && previous) {
      return previous;
    }
    return response;
  });
}

// A signal counts as changed only when it goes from one shown value to
// another. Appearing (GitHub renders the merge box after the header) or
// disappearing (another tab, collapsed checks) isn't a change, so the last
// value shown is what the next one is compared to.
function signalsChanged() {
  const { state, statuses } = pullRequestSignals();
  const changed =
    differs(current.lastState, state) ||
    differs(current.lastStatuses, statuses);
  current.lastState = state || current.lastState;
  current.lastStatuses = statuses || current.lastStatuses;
  return changed;
}

function differs(last, now) {
  return Boolean(last && now && last !== now);
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
