import React from "react";
import { BaseStyles, Flex } from "@primer/components";
import Status from "./status";
import Group from "./group";
import { getURLParameterByName } from "./utils";

export default class SidebarReport extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.loadReportData();
  }
  componentDidUpdate(prevProps) {
    if (this.props.reportURL !== prevProps.reportURL) {
      this.loadReportData();
    }
  }

  loadReportData() {
    const jsonURL = getURLParameterByName(this.props.reportURL, "url");
    fetch(jsonURL)
      .then((response) => response.json())
      .then((data) => {
        this.setState({
          reportData: data,
        });
      });
  }

  render() {
    const { reportData } = this.state;
    const { reportURL, currentUsername, name } = this.props;

    let statusNode = <Status state="pending" explanation="Loading..." />;
    if (reportData?.status?.state) {
      statusNode = (
        <Status
          state={reportData.status.state}
          explanation={reportData.status.explanation}
        />
      );
    }

    const groupNodes = [];

    if (reportData?.status?.groups) {
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
    }

    return (
      <BaseStyles>
        <div className="discussion-sidebar-item">
          <Flex
            alignItems="center"
            justifyContent="space-between"
            className="discussion-sidebar-heading"
          >
            <div className="text-bold">
              {name === "pullapprove" ? "PullApprove" : name}
            </div>
            {reportURL ? (
              <a href={reportURL} target="_blank">
                View report
              </a>
            ) : null}
          </Flex>
          {statusNode}
          {groupNodes.length > 0 ? groupNodes : null}
        </div>
        {/* Dumb visual hack to get the divider styling as if it were next to the other sidebar items */}
        <div className="discussion-sidebar-item"></div>
      </BaseStyles>
    );
  }
}
