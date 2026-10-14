import React from "react";
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
    const reportURL = this.props.reportURL;
    const jsonURL = getURLParameterByName(reportURL, "url");
    this.setState({ reportData: null, loadError: null });
    fetch(jsonURL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Report returned HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        // Ignore a response for a report we've since moved on from.
        if (this.props.reportURL === reportURL) {
          this.setState({ reportData: data });
        }
      })
      .catch((error) => {
        // Report links are signed and expire, so an old PR's report comes
        // back as an XML error body instead of JSON.
        if (this.props.reportURL === reportURL) {
          this.setState({ loadError: error });
        }
      });
  }

  render() {
    const { reportData, loadError } = this.state;
    const { reportURL, currentUsername, name } = this.props;

    let statusNode = <Status state="pending" explanation="Loading..." />;
    if (loadError) {
      statusNode = <Status state="error" explanation="Couldn't load report." />;
    } else if (reportData?.status?.state) {
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
      <div>
        <div className="discussion-sidebar-item">
          <div
            className="discussion-sidebar-heading"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div className="text-bold">
              {name === "pullapprove" ? "PullApprove" : name}
            </div>
            {reportURL ? (
              <a href={reportURL} target="_blank">
                View report
              </a>
            ) : null}
          </div>
          {statusNode}
          {groupNodes.length > 0 ? groupNodes : null}
        </div>
        {/* Dumb visual hack to get the divider styling as if it were next to the other sidebar items */}
        <div className="discussion-sidebar-item"></div>
      </div>
    );
  }
}
