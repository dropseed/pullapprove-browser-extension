// Runs on PullApprove's extension connect page. After "Connect this browser",
// the page carries a token for this browser in data-token; this takes it off
// the page, hands it to the service worker to keep, and shows that it worked.
// Before the form is submitted there's no token and nothing to do.
//
// This file imports nothing, so Parcel builds it on its own with no chunk
// shared with content.js.
const el = document.getElementById("pullapprove-extension-connect");

if (el && el.dataset.token) {
  const token = el.dataset.token;
  delete el.dataset.token;

  chrome.runtime
    .sendMessage({ type: "storeToken", token })
    .then((reply) => {
      if (reply && reply.ok) {
        el.dataset.status = "connected";
        el.querySelector("[data-pending]")?.setAttribute("hidden", "");
        el.querySelector("[data-connected]")?.removeAttribute("hidden");
      } else {
        failed("the extension refused the token");
      }
    })
    .catch((error) => {
      failed(String(error));
    });
}

// The page shows its own copy for data-status="failed"; the reason goes to
// the console for whoever is debugging. The token stays valid on the server
// until it expires unused or is disconnected from the account page.
function failed(reason) {
  el.dataset.status = "failed";
  console.warn("PullApprove: connecting this browser failed:", reason);
}
