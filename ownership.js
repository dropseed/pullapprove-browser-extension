export const pullapproveOrigin = "https://5.pullapprove.com";

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function strings(value) {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function pullRequest(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const match = parsed.pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/([1-9]\d*)\/(?:changes|files)\/?$/
  );
  if (parsed.origin !== "https://github.com" || !match) return null;
  const [, owner, repo, number] = match;
  if (![owner, repo].every((part) => /^[\w.-]+$/.test(part))) return null;
  return { owner, repo, number };
}

export function workspace(html) {
  const tag = html.match(/<div\b[^>]*\sid=["']diff-workspace["'][^>]*>/i)?.[0];
  if (!tag) throw new Error("Sign in to PullApprove, then reload ownership.");
  const attribute = (name) => {
    const value = tag.match(new RegExp("\\s" + name + '="([^"]*)"'))?.[1];
    if (!value) throw new Error("PullApprove workspace format changed.");
    return value.replace(
      /&(?:quot|amp|apos|lt|gt|#\d+|#x[\da-f]+);/gi,
      (entity) => {
        const named = {
          "&quot;": '"',
          "&amp;": "&",
          "&apos;": "'",
          "&lt;": "<",
          "&gt;": ">",
        };
        if (Object.hasOwn(named, entity)) return named[entity];
        const hex = entity.toLowerCase().startsWith("&#x");
        return String.fromCodePoint(
          parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10)
        );
      }
    );
  };
  const endpoint = attribute("data-pullrequest-url");
  if (!/^\/internal\/api\/pullrequests\/[\da-f-]{36}\/$/.test(endpoint)) {
    throw new Error("Unexpected PullApprove report endpoint.");
  }
  return { endpoint, viewer: JSON.parse(attribute("data-viewer")) };
}

export function ownershipReport(report, viewer, username) {
  if (
    !object(report) ||
    !object(report.scope_results) ||
    !object(report.path_results) ||
    !object(report.code_results) ||
    !object(viewer) ||
    !Array.isArray(viewer.accounts) ||
    typeof username !== "string" ||
    !username
  )
    throw new Error("Incomplete PullApprove ownership data.");

  if (report.repo_disabled || report.no_verdict) {
    throw new Error(
      "PullApprove has not evaluated this PR. All files remain visible."
    );
  }
  const accounts = viewer.accounts.filter(
    (account) =>
      object(account) &&
      typeof account.username === "string" &&
      account.username.toLowerCase() === username.toLowerCase()
  );
  if (!accounts.length) {
    throw new Error(
      "Sign in to PullApprove with the GitHub account reviewing this PR."
    );
  }
  const identities = new Set(
    accounts.flatMap((account) =>
      [account.username, account.host_id]
        .filter((id) => typeof id === "string")
        .map((id) => id.toLowerCase())
    )
  );
  const mine = new Map();
  for (const [name, result] of Object.entries(report.scope_results)) {
    const scope = result?.scope;
    if (
      !object(result) ||
      result.error_message ||
      !object(scope) ||
      !strings(scope.reviewers) ||
      !strings(scope.alternates) ||
      !strings(scope.code) ||
      !object(result.reviewer_states)
    ) {
      throw new Error("Incomplete PullApprove scope data.");
    }
    // Match PullApprove's focus behavior, including alternates and prior reviewers.
    if (
      [...scope.reviewers, ...scope.alternates].some(
        (id) => id !== "*" && identities.has(id.toLowerCase())
      ) ||
      Object.keys(result.reviewer_states).some((id) =>
        identities.has(id.toLowerCase())
      )
    ) {
      mine.set(name, new Set());
    }
  }

  const codeOwners = new Set();
  for (const result of Object.values(report.code_results)) {
    if (
      !object(result?.code) ||
      typeof result.code.path !== "string" ||
      !strings(result.code.scopes)
    )
      throw new Error("Incomplete code ownership data.");
    if (
      result.code.scopes.some(
        (name) => !Object.hasOwn(report.scope_results, name)
      )
    ) {
      throw new Error("Unknown scope in PullApprove code data.");
    }
    const matches = result.code.scopes.filter((name) => mine.has(name));
    for (const name of matches) mine.get(name).add(result.code.path);
    if (matches.length) codeOwners.add(result.code.path);
  }
  const paths = Object.entries(report.path_results)
    .map(([path, result]) => {
      if (
        !object(result?.path) ||
        result.path.path !== path ||
        !strings(result.path.scopes)
      ) {
        throw new Error("Incomplete path ownership data.");
      }
      const scopes = result.path.scopes;
      if (scopes.some((name) => !Object.hasOwn(report.scope_results, name))) {
        throw new Error("Unknown scope in PullApprove path data.");
      }
      const matches = scopes.filter(
        (name) =>
          mine.has(name) && report.scope_results[name].scope.code.length === 0
      );
      for (const name of matches) mine.get(name).add(path);
      return { path, owned: codeOwners.has(path) || matches.length > 0 };
    })
    .concat(
      [...codeOwners]
        .filter((path) => !Object.hasOwn(report.path_results, path))
        .map((path) => ({ path, owned: true }))
    );
  return {
    paths,
    scopes: [...mine].map(([name, paths]) => ({ name, paths: [...paths] })),
  };
}

export function shouldHide(file, paths, includeUnclassified = false) {
  const names = [file.path, file.previousPath].filter(Boolean);
  if (names.some((name) => paths.get(name) === true)) return false;
  if (!includeUnclassified) return true;
  if (file.changeType === "RENAMED" && !file.previousPath) return false;
  return names.length > 0 && names.every((name) => paths.get(name) === false);
}
