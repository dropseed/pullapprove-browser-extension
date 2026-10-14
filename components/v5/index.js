import React from "react";
import Panel from "./panel";
import FilesTab from "./files-tab";
import { fetchPullRequest } from "./utils";
import { mountAboveSidebar } from "../page";

// PullApprove 5: the PR is looked up on PullApprove by org/repo/number (via
// the service worker, with the viewer's PullApprove session), then rendered
// as a sidebar panel and, on the files tab, as marks on your files plus an
// "only files in my scopes" filter.

const SIDEBAR_ID = "pullapprove-v5-sidebar";

// One PR at a time: its fetch, the sidebar React root, and the files tab UI.
const EMPTY = { key: null, promise: null, root: null, filesTab: null };
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
    current.promise = fetchPullRequest(page);
  }

  const response = await current.promise;
  if (current.key !== key) {
    // Navigated to another PR while the fetch was in flight.
    return;
  }
  if (response.status === 0) {
    console.warn("PullApprove: could not reach PullApprove", response.error);
  }

  renderSidebar(response);
  renderFilesTab(page, response);
}

function renderSidebar(response) {
  if (document.getElementById(SIDEBAR_ID)) {
    return;
  }
  current.root?.unmount();
  current.root = mountAboveSidebar(SIDEBAR_ID, <Panel response={response} />);
}

// The files tab UI lives only while the files tab is showing: it's torn down
// on the way to another tab and rebuilt on the way back. GitHub serves the
// tab at /files and redirects to /changes.
function renderFilesTab(page, response) {
  if (!["files", "changes"].includes(page.tab)) {
    current.filesTab?.remove();
    current.filesTab = null;
    return;
  }
  if (current.filesTab || response.status !== 200) {
    return;
  }
  current.filesTab = new FilesTab(response.data);
}
