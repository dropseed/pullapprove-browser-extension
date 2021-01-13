import React from "react";
import { BaseStyles, Box, Flex, Heading } from "@primer/components";
import Status from "./status";
import Group from "./group";

export default class Sidebar extends React.Component {
  // openFullReport = () => {
  //     const w = 800
  //     const h = 600
  //     const y = window.top.outerHeight / 2 + window.top.screenY - (h / 2);
  //     const x = window.top.outerWidth / 2 + window.top.screenX - (w / 2);
  //     window.open(this.props.reportURL, "pullapprove-report", `width=${w},height=${h},top=${y},left=${x}`)
  // }
  render() {
    const { reportData, reportURL, currentUsername } = this.props;
    const groupNodes = [];
    Object.entries(reportData.status.groups).forEach(([name, data]) => {
      if (data.is_active) {
        groupNodes.push(
          <Group
            key={name}
            name={name}
            data={data}
            currentUsername={currentUsername}
          />
        );
      }
    });

    return (
      <BaseStyles>
        <div className="discussion-sidebar-item">
          <Flex
            alignItems="center"
            justifyContent="space-between"
            className="discussion-sidebar-heading text-bold"
          >
            <div>PullApprove</div>
            <a href={reportURL}>View report</a>
          </Flex>
          <Status
            state={reportData.status.state}
            explanation={reportData.status.explanation}
          />
          {groupNodes.length > 0 ? groupNodes : null}
        </div>
        {/* Dumb visual hack to get the divider styling as if it were next to the other sidebar items */}
        <div className="discussion-sidebar-item"></div>
      </BaseStyles>
    );
  }
}
