// The content script runs inside github.com, so it can't call PullApprove
// directly (cross-origin, and it needs the PullApprove session cookie). The
// service worker has host permission for 5.pullapprove.com, the one permission
// this extension adds, so it does the fetch and hands the JSON back.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "fetchPullRequest") {
    return false;
  }
  reloadIfRebuilt();

  fetch(message.url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      "PullApprove-Extension": chrome.runtime.getManifest().version,
    },
  })
    .then(async (response) => {
      // A PullApprove too old to have the endpoint answers with its HTML 404
      // page; one that has it always answers JSON, even for errors.
      const json = (response.headers.get("Content-Type") || "").includes(
        "application/json"
      );
      const data = json ? await response.json() : null;
      sendResponse({ status: response.status, json, data });
    })
    .catch((error) => {
      sendResponse({
        status: 0,
        json: false,
        data: null,
        error: String(error),
      });
    });

  // Keep the message channel open for the async sendResponse.
  return true;
});

// Development convenience: an unpacked build (no Web Store update_url) reloads
// itself when dist/content.js changes, so a rebuild only needs the page
// refreshed, not the extension. The signature of the build that loaded is
// taken when the worker starts and compared whenever a page asks for data.
// (The worker is restarted by Chrome when idle, which re-takes the baseline;
// a rebuild during such a gap needs one manual reload.)
let loadedBuild = null;

async function buildSignature() {
  const response = await fetch(chrome.runtime.getURL("dist/content.js"));
  const text = await response.text();
  return `${text.length}:${text.slice(-500)}`;
}

async function reloadIfRebuilt() {
  if (chrome.runtime.getManifest().update_url) {
    return;
  }
  const current = await buildSignature();
  if (loadedBuild === null) {
    loadedBuild = current;
  } else if (loadedBuild !== current) {
    chrome.runtime.reload();
  }
}

// Record the build that just loaded, before any page asks for data.
reloadIfRebuilt();
