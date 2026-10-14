import React from "react";
import { createRoot } from "react-dom/client";
import Sidebar from "./components/sidebar";
import { startOwnedFiles } from "./owned-files";

startOwnedFiles(document, window.location, (request) =>
  chrome.runtime.sendMessage(request)
);

// GitHub redesigned the PR checks UI -- status check links moved outside
// .discussion-timeline-actions into a new React-based component tree.
// Use the broader .pull-discussion-timeline container which contains both.
const reportLinksContainer = document.querySelector(
  ".pull-discussion-timeline"
);

const githubSidebar = document.querySelector("#partial-discussion-sidebar");
if (reportLinksContainer && githubSidebar?.parentNode) {
  const pullapproveSidebarContainer = document.createElement("div");
  githubSidebar.parentNode.prepend(pullapproveSidebarContainer);
  createRoot(pullapproveSidebarContainer).render(
    <Sidebar reportLinksContainer={reportLinksContainer} />
  );
}
