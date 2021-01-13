import React from "react";
import ReactDOM from "react-dom";
import Sidebar from "./components/sidebar";
import { getURLParameterByName } from "./components/utils";

const pr = document.querySelector(".merge-pr");
if (!pr) return;

const links = pr.querySelectorAll(
  "a[href^='https://app.pullapprove.com/report/']"
);
if (links.length < 1) return;

// could be more?
const reportURL = links[0].href;
const jsonURL = getURLParameterByName(reportURL, "url");
// use fingerprint to cache local? or does browser cover that?

const currentUsername = document.querySelector("meta[name='user-login']")
  .content;

fetch(jsonURL)
  .then((response) => response.json())
  .then((data) => {
    console.log(data);
    // Add our own div outside of the sidebar partial, but inside the container which
    // does the actual layout sizing
    const pullapproveContainer = document.createElement("div");
    const githubSidebar = document.querySelector("#partial-discussion-sidebar");
    githubSidebar.parentNode.prepend(pullapproveContainer);
    ReactDOM.render(
      <Sidebar
        currentUsername={currentUsername}
        reportData={data}
        reportURL={reportURL}
      />,
      pullapproveContainer
    );
  });
