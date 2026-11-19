import React from "react";
import SidebarReport from "./sidebar-report";
import { getCurrentUsername } from "./utils";

// A report for each PullApprove v3 status found ({ status name: Details URL }).
export default function Sidebar({ reports }) {
  const currentUsername = getCurrentUsername();
  return Object.entries(reports).map(([statusName, url]) => (
    <SidebarReport
      key={statusName}
      name={statusName}
      currentUsername={currentUsername}
      reportURL={url}
    />
  ));
}
