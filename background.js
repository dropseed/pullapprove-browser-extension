// chrome.runtime.onInstalled.addListener(async () => {
//   let rule = {
//     conditions: [
//       new chrome.declarativeContent.PageStateMatcher({
//         pageUrl: { hostEquals: "github.com" },
//       }),
//     ],
//     actions: [
//       new chrome.declarativeContent.RequestContentScript({
//         js: ["dist/content.js"],
//       }),
//     ],
//   };

//   chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
//     chrome.declarativeContent.onPageChanged.addRules([rule]);
//   });
// });

// this just enables it, but we can always have it enabled
// (you can't pop it open automatically...)
// chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
//   if (!tab.url) return;

//   if (info.status === "complete" && tab.active) {
//     const url = new URL(tab.url);
//     if (url.hostname === "github.com") {
//         console.log("Showing panel on url", url);
//       await chrome.sidePanel.setOptions({
//         tabId,
//         enabled: true,
//       });
//       chrome.sidePanel.open(tabId);
//     }
//   }
// });

// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// // RUn something when the panel is opened
// chrome.sidePanel.onPanelOpen.addListener(async (tabId) => {
//     console.log("Panel opened on tab", tabId);
//     // chrome.sidePanel.setOptions({
//     //   tabId,
//     //   enabled: true,
//     // });
//     }
// );
