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
  // Conversation tab. The PullApprove panels mount just above it (v3 and
  // v5). A Rails-era id; when GitHub moves this page to React, this is the
  // first thing to check.
  sidebar: "#partial-discussion-sidebar",
  // Conversation tab. Where the v3 status-check report links appear.
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
  // with a stable prefix. Missing: no refetch when the PR changes state.
  stateLabel: "[class*='StateLabel-StateLabel']",
  // Conversation tab, merge box. A status row per context, labelled with the
  // context name; its text carries the description. Every PullApprove
  // instance posts one (`pullapprove5`, `pullapprove5-<name>` self-hosted).
  // Absent while the checks list is collapsed. Missing: no refetch when
  // PullApprove posts a new status.
  pullapproveStatuses: "li[aria-label^='pullapprove' i]",
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

// GitHub renders its pages in stages, so a selector that finds nothing right
// after a navigation usually just hasn't rendered yet. `isPresent` is checked
// again once things have settled, and the selector is reported (once per
// page) only if it's still missing then.
const pending = new Set();
const reported = new Set();

export function reportIfStillMissing(name, isPresent) {
  if (pending.has(name) || reported.has(name)) {
    return;
  }
  pending.add(name);
  setTimeout(() => {
    pending.delete(name);
    if (!isPresent() && !reported.has(name)) {
      reported.add(name);
      console.debug(
        `PullApprove: GitHub element not found: ${name} (${SELECTORS[name]}). ` +
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

// What the page currently says about the PR's review state: GitHub's state
// label, and the text of PullApprove's status rows. GitHub updates both live,
// so a change in either means PullApprove's answer may have changed too.
// Either part is "" when it isn't rendered (another tab, collapsed checks).
export function pullRequestSignals() {
  return {
    state:
      document.querySelector(SELECTORS.stateLabel)?.textContent.trim() || "",
    statuses: [...document.querySelectorAll(SELECTORS.pullapproveStatuses)]
      .map((row) => row.textContent.trim())
      .join("\n"),
  };
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
