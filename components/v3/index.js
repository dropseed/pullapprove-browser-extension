import React from "react";
import Sidebar from "./sidebar";
import { mountAboveSidebar } from "../page";
import { SELECTORS } from "../github";

// PullApprove v3: the status check's "Details" link carries a `?url=` to a
// JSON report. The sidebar watches the page for those links and renders each
// report it finds. Nothing here talks to PullApprove 5.

const CONTAINER_ID = "pullapprove-v3-sidebar";
let root = null;

export function mountV3() {
  if (document.getElementById(CONTAINER_ID)) {
    return;
  }
  unmountV3();
  const reportLinksContainer = document.querySelector(SELECTORS.timeline);
  if (!reportLinksContainer) {
    return;
  }
  root = mountAboveSidebar(
    CONTAINER_ID,
    <Sidebar reportLinksContainer={reportLinksContainer} />
  );
}

export function unmountV3() {
  root?.unmount();
  root = null;
  document.getElementById(CONTAINER_ID)?.remove();
}
