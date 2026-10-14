import {
  ownershipReport,
  pullRequest,
  pullapproveOrigin,
  workspace,
} from "./ownership.js";

async function read(url, json = false) {
  const response = await fetch(url, {
    credentials: "include",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`PullApprove returned HTTP ${response.status}.`);
  const body = await response.text();
  if (body.length > 5_000_000)
    throw new Error("PullApprove response is too large.");
  return json ? JSON.parse(body) : body;
}

async function loadOwnership(request, sender) {
  const pr = pullRequest(sender.url);
  if (
    !pr ||
    sender.frameId !== 0 ||
    request.type !== "pullapprove-ownership" ||
    typeof request.username !== "string" ||
    !/^[\w-]+$/.test(request.username)
  ) {
    throw new Error("Unsupported ownership request.");
  }
  const pageURL = `${pullapproveOrigin}/gh/${pr.owner}/${pr.repo}/pulls/${pr.number}/`;
  const { endpoint, viewer } = workspace(await read(pageURL));
  return ownershipReport(
    await read(pullapproveOrigin + endpoint, true),
    viewer,
    request.username
  );
}

chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (request?.type !== "pullapprove-ownership") return false;
  loadOwnership(request, sender).then(
    (data) => respond({ data }),
    (error) =>
      respond({
        error: error.message || "Could not load PullApprove ownership.",
      })
  );
  return true;
});
