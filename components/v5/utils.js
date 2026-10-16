const BASE_URL = "https://5.pullapprove.com";

// Asks the service worker to fetch the PR from PullApprove's extension endpoint
// (see background.js). Resolves to { status, json, data }: `data` is the body
// when it was JSON — on a 200 the payload (status, next steps, scopes, and
// files, each already marked as the viewer's or not), on an error the server's
// { id, message }. The extension does no ownership math.
//
// The endpoint path carries the payload version this build understands; the
// request carries this build's version so the server can tell builds apart.
export async function fetchPullRequest({ org, repo, number }) {
  const url = `${BASE_URL}/extension/v1/gh/${encodeURIComponent(
    org
  )}/${encodeURIComponent(repo)}/pulls/${number}/`;
  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: "fetchPullRequest",
      url,
    });
  } catch (error) {
    // The service worker went away mid-request, or the extension was updated
    // under this page ("Extension context invalidated"). Same as a network
    // failure.
    response = { status: 0, json: false, data: null, error: String(error) };
  }
  return { ...response, baseUrl: BASE_URL };
}
