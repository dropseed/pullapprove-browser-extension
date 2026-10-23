// The content script runs inside github.com, so it can't call PullApprove
// directly (cross-origin). The service worker has host permission for
// 5.pullapprove.com, so it does the fetch and hands the JSON back.
//
// Requests authenticate with a per-browser token, not the PullApprove session
// cookie (which some browsers, like Safari, never send from an extension).
// The token comes from PullApprove's connect page, where connect.js passes it
// here to keep in chrome.storage.local. A 401 means it was revoked or expired,
// so it's dropped and the sidebar goes back to asking to connect.

// Must match BASE_URL in components/v5/utils.js. This file isn't bundled, so
// it can't import it.
const BASE_URL = "https://5.pullapprove.com";
const CONNECT_URL = BASE_URL + "/extension/connect/";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "storeToken") {
    storeToken(message, sender, sendResponse);
    // Keep the message channel open for the async sendResponse.
    return true;
  }
  if (message.type === "fetchPullRequest") {
    reloadIfRebuilt();
    fetchPullRequest(message, sendResponse);
    // Keep the message channel open for the async sendResponse.
    return true;
  }
  return false;
});

// Only this extension's own content script on the connect page may set the
// token, so no other page can point the extension at someone else's account.
function storeToken(message, sender, sendResponse) {
  const fromConnectPage =
    sender.id === chrome.runtime.id &&
    typeof sender.url === "string" &&
    sender.url.startsWith(CONNECT_URL);
  if (!fromConnectPage || typeof message.token !== "string" || !message.token) {
    sendResponse({ ok: false });
    return;
  }
  chrome.storage.local
    .set({ token: message.token })
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));
}

async function fetchPullRequest(message, sendResponse) {
  // The token only ever goes to PullApprove's extension endpoints: the URL
  // is parsed (so `..` segments can't escape the path) and a redirect
  // elsewhere is refused below rather than followed with the token attached.
  if (!isExtensionEndpoint(message.url)) {
    sendResponse({
      status: 0,
      json: false,
      data: null,
      error:
        "Refusing to fetch a URL outside PullApprove's extension endpoints",
    });
    return;
  }

  try {
    const { token } = await chrome.storage.local.get("token");
    if (!token) {
      // Not connected yet: answer like the server would, without asking it.
      sendResponse({ status: 401, json: false, data: null });
      return;
    }

    const response = await fetch(message.url, {
      credentials: "omit",
      redirect: "error",
      headers: {
        Accept: "application/json",
        "PullApprove-Extension": chrome.runtime.getManifest().version,
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.status === 401) {
      // Revoked or expired. Removing it also tells open PR tabs to refetch
      // (see components/v5/index.js), which then show the Connect prompt.
      // Only the token this request used is removed: the user may have
      // connected again while it was in flight.
      const stored = await chrome.storage.local.get("token");
      if (stored.token === token) {
        await chrome.storage.local.remove("token");
      }
    }
    // A PullApprove too old to have the endpoint answers with its HTML 404
    // page; one that has it always answers JSON, even for errors.
    const json = (response.headers.get("Content-Type") || "").includes(
      "application/json"
    );
    const data = json ? await response.json() : null;
    sendResponse({ status: response.status, json, data });
  } catch (error) {
    sendResponse({
      status: 0,
      json: false,
      data: null,
      error: String(error),
    });
  }
}

function isExtensionEndpoint(url) {
  if (typeof url !== "string") {
    return false;
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.origin === BASE_URL && parsed.pathname.startsWith("/extension/")
  );
}

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
  // Only an unpacked build in Chrome. Safari and Firefox builds have no
  // update_url either, but they aren't dev builds.
  if (
    chrome.runtime.getManifest().update_url ||
    !navigator.userAgent.includes("Chrome/")
  ) {
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
