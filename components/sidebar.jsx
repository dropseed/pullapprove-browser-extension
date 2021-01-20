import React from "react";
import SidebarReport from "./sidebar-report";
import { getCurrentUsername, getURLParameterByName } from "./utils";

export default class Sidebar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.setState({
      currentUsername: getCurrentUsername(),
      observer: this.createObserver(),
      reports: this.findReports(this.props.mergingNode),
    });
  }

  componentWillUnmount() {
    if (this.state.observer) {
      this.state.observer.disconnect();
    }
  }

  createObserver() {
    const sidebar = this;
    const observerCallback = function (mutationsList, observer) {
      const firstMutation = mutationsList[0];
      if (
        firstMutation.type === "childList" &&
        firstMutation.addedNodes.length === 1 &&
        firstMutation.addedNodes[0].id === sidebar.props.mergingNode.id
      ) {
        sidebar.setState({
          reports: sidebar.findReports(firstMutation.addedNodes[0]),
        });
      }
    };

    const observer = new MutationObserver(observerCallback);

    observer.observe(this.props.mergingNode.parentNode, {
      childList: true,
      subtree: true,
    });

    return observer;
  }

  findReports(targetNode) {
    const links = targetNode.querySelectorAll(".status-actions");
    const reports = {};
    links.forEach((link) => {
      const statusName = link.parentNode.previousElementSibling.children[0].innerText.trim();
      if (
        statusName.toLowerCase().indexOf("pullapprove") !== -1 &&
        getURLParameterByName(link.href, "url") !== null
      ) {
        reports[statusName] = link.href;
      }
    });
    return reports;
  }

  render() {
    const { reports, currentUsername } = this.state;
    if (!reports) {
      return null;
    }
    return Object.entries(reports).map(([statusName, url]) => (
      <SidebarReport
        key={statusName}
        name={statusName}
        currentUsername={currentUsername}
        reportURL={url}
      />
    ));
  }
}
