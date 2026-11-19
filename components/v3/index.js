import React from "react";
import Sidebar from "./sidebar";
import { getURLParameterByName } from "./utils";
import { mountAtTopOfSidebar } from "../page";
import { SELECTORS, fetchStatusChecks, findSidebar } from "../github";

// PullApprove v3: the status check's "Details" link carries a `?url=` to a
// JSON report. The sidebar renders each report found: on the classic
// Conversation page by watching the page for those links, on the Overview
// by asking GitHub for the pull request's statuses (its checks list is
// collapsed, so the links aren't in the page). Nothing here talks to
// PullApprove 5.

const CONTAINER_ID = "pullapprove-v3-sidebar";

// On the Overview, how often the statuses are read again while the tab is
// visible: soon while a report is showing (its link changes as people
// review), less often while there isn't one, to notice one being posted. A
// hidden tab doesn't read, and catches up within a second of being looked at.
const POLL_MS = 15 * 1000;
const IDLE_POLL_MS = 60 * 1000;

// One PR at a time: the reports last found ({ status name: Details URL }),
// and when the Overview last read them. Kept while GitHub re-renders the
// sidebar, so a re-mount shows them at once.
const EMPTY = { key: null, reports: {}, fetchedAt: 0, fetching: false };
let current = { ...EMPTY };
// The mounted sidebar, and on the classic page what's watching for links.
let root = null;
let observer = null;

function unmountSidebar() {
  root?.unmount();
  root = null;
  observer?.disconnect();
  observer = null;
  document.getElementById(CONTAINER_ID)?.remove();
}

export function unmountV3() {
  unmountSidebar();
  current = { ...EMPTY };
}

export function mountV3(page) {
  if (current.key !== page.key) {
    unmountV3();
    current.key = page.key;
  }
  if (page.tab !== "conversation") {
    unmountSidebar();
    return;
  }
  const sidebar = findSidebar();
  if (sidebar?.overview) {
    readStatusChecks(page);
  }
  if (document.getElementById(CONTAINER_ID)) {
    return;
  }
  unmountSidebar();
  if (!sidebar) {
    return;
  }
  if (!sidebar.overview) {
    const reportLinksContainer = document.querySelector(SELECTORS.timeline);
    if (!reportLinksContainer) {
      return;
    }
    show(findReports(reportLinksContainer));
    observer = new MutationObserver(() =>
      show(findReports(reportLinksContainer))
    );
    observer.observe(reportLinksContainer, { childList: true, subtree: true });
  }
  root = mountAtTopOfSidebar(
    CONTAINER_ID,
    <Sidebar reports={current.reports} />
  );
}

// Re-renders only when the reports changed.
function show(reports) {
  if (JSON.stringify(reports) === JSON.stringify(current.reports)) {
    return;
  }
  current.reports = reports;
  root?.render(<Sidebar reports={reports} />);
}

// A failed read keeps the last reports up.
async function readStatusChecks(page) {
  const showing = Object.keys(current.reports).length > 0;
  const due =
    Date.now() - current.fetchedAt > (showing ? POLL_MS : IDLE_POLL_MS);
  if (current.fetching || document.hidden || !due) {
    return;
  }
  const state = current;
  state.fetching = true;
  state.fetchedAt = Date.now();
  const checks = await fetchStatusChecks(page);
  if (current !== state) {
    // Navigated away while this was in flight (even if back to this PR,
    // which started over with its own read).
    return;
  }
  state.fetching = false;
  if (checks) {
    const reports = {};
    checks.forEach(({ name, url }) => {
      if (isReport(name, url)) {
        reports[name] = url;
      }
    });
    show(reports);
  }
}

// A PullApprove v3 status: named for PullApprove, with a Details link that
// carries the report's `?url=`.
function isReport(statusName, url) {
  return (
    statusName.toLowerCase().indexOf("pullapprove") !== -1 &&
    Boolean(url) &&
    getURLParameterByName(url, "url") !== null
  );
}

// The classic page's report links, wherever its merge box puts them.
function findReports(reportLinksContainer) {
  const reports = {};

  // Original merge experience style links
  reportLinksContainer.querySelectorAll("a.status-actions").forEach((link) => {
    const statusName = (
      link.parentNode?.previousElementSibling?.children?.[0]?.innerText || ""
    ).trim();
    if (isReport(statusName, link.href)) {
      reports[statusName] = link.href;
    }
  });

  // New merge experience style links
  reportLinksContainer.querySelectorAll("a").forEach((link) => {
    const statusName = link.innerText.trim();
    if (isReport(statusName, link.href)) {
      reports[statusName] = link.href;
    }
  });

  return reports;
}
