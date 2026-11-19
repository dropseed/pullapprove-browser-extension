// Everything the extension knows about GitHub's pull request pages, in one
// place: the DOM it hooks into, and what it can read from the page. When
// GitHub changes its markup, this is the file to fix.
//
// Each selector says what it is and which part of the extension stops
// working if it goes missing; everything else degrades silently. Callers
// report a selector that found nothing where it was expected, via
// reportIfStillMissing, so a "the extension disappeared" report can be answered
// from the console.

export const SELECTORS = {
  // Two pages serve a pull request's first tab: the classic Conversation
  // page, and the React "Overview" (a feature preview each user opts into;
  // `?overview=false` shows the classic page for one visit). The PullApprove
  // panels (v3 and v5) go at the top of whichever sidebar is there. Both
  // missing on that tab: no panels.
  //
  // Classic: a Rails-era id. The panels mount just above it.
  sidebar: "#partial-discussion-sidebar",
  // Overview: a test id on the column of sidebar sections. The panels mount
  // inside it, ahead of GitHub's sections.
  overviewSidebar: "[data-testid='sticky-sidebar']",
  // Classic Conversation tab. Where the v3 status-check report links appear.
  // The Overview has no equivalent (its checks list is collapsed, so the
  // links aren't in the page); v3 asks GitHub for its statuses there, via
  // fetchStatusChecks.
  timeline: ".pull-discussion-timeline",
  // Files tab. The "Filter files..." box the All/Mine toggle goes under,
  // rendered twice: in the sidebar tree and in the narrow layout's Files
  // drawer. Missing: no toggle.
  fileTreeFilter: "#diff-file-tree-filter",
  // Files tab. Each file's diff container, id `diff-<sha256(path)>`; its
  // parent is the entry the filter hides. Missing: no marks, no hiding.
  diffContainers: "div[id^='diff-']",
  // Files tab. The filename heading inside a diff container, where the scope
  // label goes. A hashed class with a stable prefix. Missing: no header
  // labels (tree marks still work).
  fileHeading: "h3[class*='file-name']",
  // Files tab. Tree rows: id is the file's path (directories too). Missing:
  // the tree isn't filtered.
  treeItems: "[role='treeitem'][id]",
  // Files tab. A file row's link, whose hash is the same `#diff-<digest>`
  // anchor as the diff container. Missing: no tree marks.
  treeFileLinks: "[role='treeitem'] a[href^='#diff-']",
  // PR header, every tab. The Open/Draft/Merged/Closed label, a hashed class
  // with a stable prefix. Missing: a state change waits for the next poll.
  stateLabel: "[class*='StateLabel-StateLabel']",
  // The JSON the React files view is bootstrapped from on a full page load.
  // Read-only: a partial-view check, with a URL fallback.
  embeddedData: 'script[data-target="react-app.embeddedData"]',
};

const DIFF_ID = /^diff-([0-9a-f]{64})$/;

// The digest in a diff container's id, or undefined for other `diff-` ids
// GitHub uses (`diff-file-tree-filter`, `diff-comparison-viewer-container`).
export function diffContainerDigest(container) {
  return container.id.match(DIFF_ID)?.[1];
}

// The PR sidebar on the first tab, as { element, overview } (overview: the
// React Overview's, not the classic page's), or null when there isn't one.
export function findSidebar() {
  const classic = document.querySelector(SELECTORS.sidebar);
  if (classic) {
    return { element: classic, overview: false };
  }
  const overview = document.querySelector(SELECTORS.overviewSidebar);
  return overview ? { element: overview, overview: true } : null;
}

// Something about GitHub that stopped matching what the extension expects,
// logged once per page load (GitHub's client-side navigation doesn't count
// as a new one).
const reported = new Set();

function debugOnce(name, message) {
  if (!reported.has(name)) {
    reported.add(name);
    console.debug(`PullApprove: ${message}`);
  }
}

// GitHub renders its pages in stages, so a selector that finds nothing right
// after a navigation usually just hasn't rendered yet. `isPresent` is checked
// again once things have settled, and the selector is reported (once, via
// debugOnce) only if it's still missing then.
const pending = new Set();

export function reportIfStillMissing(
  name,
  isPresent,
  selector = SELECTORS[name]
) {
  if (pending.has(name) || reported.has(name)) {
    return;
  }
  pending.add(name);
  setTimeout(() => {
    pending.delete(name);
    if (!isPresent()) {
      debugOnce(
        name,
        `GitHub element not found: ${name} (${selector}). ` +
          "GitHub's markup may have changed."
      );
    }
  }, 3000);
}

// What GitHub's files view tells us about the diff it's rendering: whether it
// is partial — a selected commit range, single-file mode, a virtualized long
// diff, or a diff over GitHub's file limit. Hiding files is only safe on a
// complete view.
//
// On a full page load the React app is bootstrapped from a JSON blob in the
// page that says all of this. After a client-side hop from another tab the
// blob still describes that other tab, so the URL (which carries a selected
// commit range) is the fallback and the rarer partial views go undetected.
export function filesViewIsPartial() {
  const changes = embeddedChangesRoute();
  if (changes) {
    return (
      changes.comparison?.viewing !== "FULL" ||
      changes.comparison?.selectedRange !== null ||
      Boolean(changes.virtualizeDiffEntries) ||
      Boolean(changes.isSingleFileMode) ||
      Boolean(changes.pageLimits?.filesLimitExceeded)
    );
  }
  // /pull/{n}/changes/{sha} or /pull/{n}/changes/{sha}..{sha}
  return /\/pull\/\d+\/(?:changes|files)\/[0-9a-f]/.test(
    window.location.pathname
  );
}

function embeddedChangesRoute() {
  const script = document.querySelector(SELECTORS.embeddedData);
  if (!script) {
    return null;
  }
  try {
    return (
      JSON.parse(script.textContent)?.payload?.pullRequestsChangesRoute || null
    );
  } catch {
    return null;
  }
}

// The pull request's commit statuses and checks, as [{ name, url }] (url is
// the Details link, or null), or null when GitHub didn't answer with them.
//
// The Overview's merge box fetches this to render its checks list, which it
// shows collapsed, so unlike on the classic page the links aren't in the DOM.
// An internal GitHub endpoint, not an API: it answers JSON only to requests
// that say they're XHR (anything else gets a 406), and its shape can change
// without notice. A change here shows up as v3 reports missing from the
// Overview, with a console message.
export async function fetchStatusChecks({ org, repo, number }) {
  const path = `/${org}/${repo}/pull/${number}/page_data/status_checks`;
  try {
    const response = await fetch(new URL(path, window.location.origin), {
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      // A request that stalls (a laptop sleeping mid-request) would otherwise
      // hold up every later read.
      signal: AbortSignal.timeout(15 * 1000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const { statusChecks } = await response.json();
    if (!Array.isArray(statusChecks)) {
      throw new Error("no statusChecks in the response");
    }
    return statusChecks.map((check) => ({
      name: check.displayName || "",
      url: check.targetUrl || null,
    }));
  } catch (error) {
    debugOnce(
      "statusChecks",
      `couldn't read the pull request's status checks from ${path}: ${error}`
    );
    return null;
  }
}

// GitHub's Open/Draft/Merged/Closed label, which it updates live; "" while
// it isn't rendered.
export function pullRequestStateLabel() {
  return document.querySelector(SELECTORS.stateLabel)?.textContent.trim() || "";
}

// GitHub anchors a file's diff (and its tree row) as `#diff-<digest>`, where
// the digest is the SHA-256 of the path.
export async function diffDigest(path) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(path)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
