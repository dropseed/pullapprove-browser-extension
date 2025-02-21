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
      reports: this.findReports(),
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
      sidebar.setState({
        reports: sidebar.findReports(),
      });
    };

    const observer = new MutationObserver(observerCallback);

    observer.observe(this.props.reportLinksContainer, {
      childList: true,
      subtree: true,
    });

    return observer;
  }

  findReports() {
    const reports = {};

    // Original merge experience style links
    const links =
      this.props.reportLinksContainer.querySelectorAll("a.status-actions");
    links.forEach((link) => {
      const statusName =
        link.parentNode.previousElementSibling.children[0].innerText.trim();
      if (
        statusName.toLowerCase().indexOf("pullapprove") !== -1 &&
        getURLParameterByName(link.href, "url") !== null
      ) {
        reports[statusName] = link.href;
      }
    });

    // New merge experience style links
    const newLinks = this.props.reportLinksContainer.querySelectorAll("a");
    newLinks.forEach((link) => {
      const statusName = link.innerText.trim();
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
