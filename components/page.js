import { createRoot } from "react-dom/client";
import { SELECTORS, reportIfStillMissing } from "./github";

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
  };
}

// Mounts a React element in a new container just above GitHub's PR sidebar.
// Returns the root, or null when this page has no sidebar (only the
// Conversation tab does). GitHub re-renders the sidebar on navigation, which
// drops the container with it, so callers re-mount whenever their container
// id is missing.
export function mountAboveSidebar(id, element) {
  const githubSidebar = document.querySelector(SELECTORS.sidebar);
  if (!githubSidebar) {
    reportIfStillMissing(
      "sidebar",
      () =>
        parsePullRequestPage(window.location.pathname)?.tab !==
          "conversation" || document.querySelector(SELECTORS.sidebar)
    );
    return null;
  }
  const container = document.createElement("div");
  container.id = id;
  githubSidebar.parentNode.insertBefore(container, githubSidebar);
  const root = createRoot(container);
  root.render(element);
  return root;
}
