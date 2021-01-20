import React from "react";
import ReactDOM from "react-dom";
import Sidebar from "./components/sidebar";

// For PR merge status, need to observe the entire merging partial
// to be able to watch for DOM changes to it and update the sidebar
const prMerging = document.querySelector("#partial-pull-merging");
if (prMerging) {
  const pullapproveSidebarContainer = document.createElement("div");
  const githubSidebar = document.querySelector("#partial-discussion-sidebar");
  githubSidebar.parentNode.prepend(pullapproveSidebarContainer);
  ReactDOM.render(
    <Sidebar mergingNode={prMerging} />,
    pullapproveSidebarContainer
  );
}
