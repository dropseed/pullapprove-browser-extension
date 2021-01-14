import React from "react";
import ReactDOM from "react-dom";
import Sidebar from "./components/sidebar";
import { getURLParameterByName } from "./components/utils";

const pr = document.querySelector(".merge-pr");
if (!pr) return;

// should find any with context name being pullapprove or pullapprove-company? no slashes allowed

const links = pr.querySelectorAll(
  "a[href^='https://app.pullapprove.com/report/']"
);

// create divs for each sidebar
// pass through the node it should observe for url changes, etc.
// it does the fetching (componentDidMount and observe change)

links.forEach(link => {

    const reportURL = link.href;
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

})
