import React from "react";
import ReactDOM from "react-dom";
import Sidebar from "./components/sidebar";

// GitHub redesigned the PR checks UI -- status check links moved outside
// .discussion-timeline-actions into a new React-based component tree.
// Use the broader .pull-discussion-timeline container which contains both.
const reportLinksContainer = document.querySelector(
  ".pull-discussion-timeline"
);

if (reportLinksContainer) {
  const pullapproveSidebarContainer = document.createElement("div");
  const githubSidebar = document.querySelector("#partial-discussion-sidebar");
  githubSidebar.parentNode.prepend(pullapproveSidebarContainer);
  ReactDOM.render(
    <Sidebar reportLinksContainer={reportLinksContainer} />,
    pullapproveSidebarContainer
  );
}
