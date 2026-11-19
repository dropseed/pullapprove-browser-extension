import { createRoot } from "react-dom/client";
import { SELECTORS, findSidebar, reportIfStillMissing } from "./github";

// github.com/{org}/{repo}/pull/{number}[/{tab}]
export function parsePullRequestPage(pathname) {
  const match = pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/([^/]*))?/
  );
  if (!match) {
    return null;
  }
  return {
    org: match[1],
    repo: match[2],
    number: parseInt(match[3], 10),
    tab: match[4] || "conversation",
    // Which pull request, whatever the tab.
    key: `${match[1]}/${match[2]}/${match[3]}`,
  };
}

function onFirstTab() {
  return parsePullRequestPage(window.location.pathname)?.tab === "conversation";
}

// Mounts a React element in a new container at the top of GitHub's PR
// sidebar, classic or Overview. Returns the root, or null when this page has
// no sidebar (only the first tab does). GitHub re-renders the sidebar on
// navigation, which drops the container with it, so callers re-mount
// whenever their container id is missing.
export function mountAtTopOfSidebar(id, element) {
  if (!onFirstTab()) {
    return null;
  }
  const sidebar = findSidebar();
  if (!sidebar) {
    reportIfStillMissing(
      "sidebar",
      () => !onFirstTab() || findSidebar(),
      `${SELECTORS.sidebar} or ${SELECTORS.overviewSidebar}`
    );
    return null;
  }

  const container = document.createElement("div");
  container.id = id;
  if (sidebar.overview) {
    // The Overview's sidebar is a flex column with a gap between items, so a
    // container that renders nothing (most pull requests, for one of v3 and
    // v5) must not be an item itself, or it'd push GitHub's sections down.
    container.style.display = "contents";
    // After any panel already mounted, the way they stack on the classic page.
    const firstOfGitHubs = [...sidebar.element.children].find(
      (child) => !child.id.startsWith("pullapprove-")
    );
    sidebar.element.insertBefore(container, firstOfGitHubs || null);
  } else {
    sidebar.element.parentNode.insertBefore(container, sidebar.element);
  }

  const root = createRoot(container);
  root.render(element);
  return root;
}
