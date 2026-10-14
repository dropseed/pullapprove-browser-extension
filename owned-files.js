import { pullRequest, pullapproveOrigin, shouldHide } from "./ownership.js";

const panelID = "pullapprove-owned-files";
const hiddenAttribute = "data-pullapprove-hidden";
const payloads = new WeakMap();

function currentDiff(document, url) {
  const parsed = new URL(url);
  const range = parsed.pathname.match(
    /^(\/[^/]+\/[^/]+\/pull\/[1-9]\d*\/(?:changes|files))\/([\da-f]{7,40}(?:\.{2,3}[\da-f]{7,40})?)\/?$/i
  );
  const pr = pullRequest(range ? `${parsed.origin}${range[1]}` : url);
  if (!pr) return null;
  const embedded = document.querySelector(
    'script[data-target="react-app.embeddedData"]'
  );
  if (!embedded) return null;
  const source = embedded.textContent;
  let cached = payloads.get(embedded);
  if (cached?.source !== source) {
    cached = { source, payload: JSON.parse(source).payload };
    payloads.set(embedded, cached);
  }
  const payload = cached.payload;
  const changes = payload?.pullRequestsChangesRoute;
  const layout = payload?.pullRequestsLayoutRoute;
  const head = layout?.pullRequest?.headSha;
  if (range) {
    if (
      !head ||
      String(layout?.pullRequest?.number) !== pr.number ||
      layout?.repository?.name?.toLowerCase() !== pr.repo.toLowerCase() ||
      layout?.repository?.ownerLogin?.toLowerCase() !== pr.owner.toLowerCase()
    )
      return null;
    return {
      ...pr,
      key: `${pr.owner}/${pr.repo}/${pr.number}/${head}/${range[2]}`,
      supported: false,
    };
  }
  if (
    !changes ||
    !head ||
    !Array.isArray(changes.diffSummaries) ||
    String(changes.pullRequest?.number) !== pr.number ||
    changes.repository?.name?.toLowerCase() !== pr.repo.toLowerCase() ||
    changes.repository?.ownerLogin?.toLowerCase() !== pr.owner.toLowerCase() ||
    changes.comparison?.fullDiff?.headOid !== head
  )
    return null;
  return {
    ...pr,
    key: `${pr.owner}/${pr.repo}/${pr.number}/${head}/${
      changes.comparison?.viewing
    }/${JSON.stringify(changes.comparison?.selectedRange)}/${
      changes.user?.currentUserLogin
    }/${Boolean(changes.virtualizeDiffEntries)}/${Boolean(
      changes.isSingleFileMode
    )}/${Boolean(changes.pageLimits?.filesLimitExceeded)}`,
    username: changes.user?.currentUserLogin,
    files: changes.diffSummaries,
    supported:
      Boolean(changes.user?.currentUserLogin) &&
      changes.comparison?.viewing === "FULL" &&
      changes.comparison?.selectedRange === null &&
      !changes.virtualizeDiffEntries &&
      !changes.isSingleFileMode &&
      !changes.pageLimits?.filesLimitExceeded,
  };
}

export function startOwnedFiles(document, location, requestOwnership) {
  let key;
  let context;
  let paths;
  let scopes;
  let renderedScopes;
  let renderedFiles;
  let pending = false;
  let attempted = false;
  let generation = 0;
  let disposed = false;
  let notice = "";
  let frame;
  const controls = document.createElement("div");
  controls.id = panelID + "-controls";
  controls.style.cssText =
    "display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;min-width:0;font-size:12px";
  const label = document.createElement("label");
  label.style.cssText =
    "display:inline-flex;align-items:center;gap:6px;font-weight:600;white-space:nowrap";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.disabled = true;
  label.append(checkbox, "Only files owned by you");
  const inline = document.createElement("span");
  inline.setAttribute("role", "status");
  const menu = document.createElement("details");
  menu.style.cssText = "position:relative";
  const summary = document.createElement("summary");
  summary.className = "btn btn-sm";
  summary.textContent = "Details ▾";
  summary.setAttribute("aria-label", "PullApprove filter details");
  const panel = document.createElement("section");
  panel.id = panelID;
  panel.tabIndex = -1;
  panel.setAttribute("aria-label", "PullApprove file ownership");
  panel.style.cssText =
    "position:fixed;width:min(380px,calc(100vw - 32px));max-height:60vh;overflow:auto;z-index:100;padding:12px;background:var(--bgColor-default,#fff);border:1px solid var(--borderColor-default,#d0d7de);border-radius:6px;font-size:12px;box-shadow:0 8px 24px #0002;";
  const status = document.createElement("div");
  const scopeList = document.createElement("section");
  scopeList.id = panelID + "-scopes";
  scopeList.setAttribute("aria-label", "Owned scopes");
  const includeLabel = document.createElement("label");
  includeLabel.style.cssText =
    "display:flex;align-items:center;gap:6px;margin-top:8px";
  const includeUnclassified = document.createElement("input");
  includeUnclassified.type = "checkbox";
  includeUnclassified.disabled = true;
  includeLabel.append(includeUnclassified, "Include unclassified files");
  const actions = document.createElement("div");
  actions.style.cssText =
    "display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:10px";
  const load = document.createElement("button");
  load.type = "button";
  load.className = "btn btn-sm";
  load.textContent = "Refresh ownership";
  const link = document.createElement("a");
  link.textContent = "Open in PullApprove";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const fullDiff = document.createElement("a");
  fullDiff.textContent = "View All commits";
  actions.append(load, link, fullDiff);
  panel.append(status, scopeList, includeLabel, actions);
  menu.append(summary, panel);
  controls.append(label, inline, menu);
  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      menu.open = false;
      summary.focus();
    }
  });
  const dismiss = (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  };
  const leave = (event) => {
    if (!menu.contains(event.relatedTarget)) menu.open = false;
  };
  const positionPanel = () => {
    if (!menu.open) return;
    const bounds = summary.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    if (
      bounds.bottom <= 0 ||
      bounds.top >= viewportHeight ||
      bounds.right <= 0 ||
      bounds.left >= viewport
    ) {
      menu.open = false;
      return;
    }
    panel.style.maxHeight = `${Math.max(
      0,
      Math.min(viewportHeight * 0.6, viewportHeight - 32)
    )}px`;
    panel.style.left = `${Math.max(
      16,
      Math.min(bounds.left, viewport - panel.offsetWidth - 16)
    )}px`;
    panel.style.top = `${Math.max(
      16,
      Math.min(bounds.bottom + 8, viewportHeight - panel.offsetHeight - 16)
    )}px`;
  };
  menu.addEventListener("toggle", positionPanel);
  document.defaultView.addEventListener("resize", positionPanel);
  document.addEventListener("scroll", positionPanel, true);
  document.addEventListener("pointerdown", dismiss);
  menu.addEventListener("focusout", leave);
  const style = document.createElement("style");
  style.textContent = `[${hiddenAttribute}] { display: none !important; }
    #${controls.id}[data-active] > label { color: var(--fgColor-accent, #0969da); }
    #${controls.id} label:has(input:enabled) { cursor: pointer; }`;

  const text = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };
  const message = (element, value) => {
    text(element, value);
    element.hidden = !value;
  };
  const renderScopes = () => {
    if (!paths || !context?.supported) {
      if (scopeList.hasChildNodes()) scopeList.replaceChildren();
      renderedScopes = undefined;
      renderedFiles = undefined;
      return;
    }
    if (renderedScopes === scopes && renderedFiles === context.files) return;
    scopeList.replaceChildren();
    for (const scope of scopes) {
      const group = document.createElement("section");
      group.style.marginTop = "8px";
      const heading = document.createElement("h3");
      heading.style.cssText = "font-size:12px;margin:0 0 4px";
      heading.textContent = scope.name;
      group.append(heading);
      const classified = new Set(scope.paths);
      const matches = context.files.filter((file) =>
        [file.path, file.previousPath].some((path) => classified.has(path))
      );
      if (matches.length) {
        const files = document.createElement("ul");
        files.style.cssText = "margin:0;padding-left:16px";
        for (const file of matches) {
          const item = document.createElement("li");
          const path = document.createElement("code");
          path.style.cssText = "white-space:normal;overflow-wrap:anywhere";
          path.textContent = file.path;
          item.append(path);
          files.append(item);
        }
        group.append(files);
      } else {
        const empty = document.createElement("p");
        empty.style.margin = "0";
        empty.textContent = "No matching classified files in this diff.";
        group.append(empty);
      }
      scopeList.append(group);
    }
    if (!scopes.length) scopeList.textContent = "No matching owned scopes.";
    renderedScopes = scopes;
    renderedFiles = context.files;
  };
  const restore = () => {
    document
      .querySelectorAll(`[${hiddenAttribute}]`)
      .forEach((node) => node.removeAttribute(hiddenAttribute));
  };
  const hide = (element, value) => {
    if (!element) return;
    if (value) {
      if (element.contains(document.activeElement)) checkbox.focus();
      element.setAttribute(hiddenAttribute, "");
    } else element.removeAttribute(hiddenAttribute);
  };
  const apply = () => {
    restore();
    controls.toggleAttribute("data-active", checkbox.checked);
    checkbox.disabled = !paths || !context?.supported || pending;
    includeUnclassified.disabled = checkbox.disabled;
    const disableLoad = pending || !context?.supported;
    if (disableLoad && document.activeElement === load) summary.focus();
    load.disabled = disableLoad;
    renderScopes();
    if (!context?.supported) {
      message(inline, "Unavailable in this view");
      message(
        status,
        "Use the full All commits, all-files diff. Filtering is unavailable for selected commits, single-file or virtualized/limited views. No files are excluded by PullApprove."
      );
      return;
    }
    if (!paths) {
      message(
        inline,
        pending
          ? "Loading ownership…"
          : "Ownership unavailable · Retry in Details"
      );
      message(status, notice || "Loading PullApprove ownership…");
      return;
    }
    const excluded = context.files.filter((file) =>
      shouldHide(file, paths, includeUnclassified.checked)
    );
    if (checkbox.checked) {
      const list = document.querySelector(
        '[data-testid="progressive-diffs-list"]'
      );
      if (
        !list ||
        excluded.some((file) => {
          const region = document.getElementById(`diff-${file.pathDigest}`);
          return region && region.parentElement?.parentElement !== list;
        })
      ) {
        checkbox.checked = false;
        notice =
          "GitHub diff layout is not recognized. No files are excluded by PullApprove.";
      } else {
        for (const file of excluded) {
          const region = document.getElementById(`diff-${file.pathDigest}`);
          // Only hide whole entries in the non-virtualized list we recognize.
          if (region?.parentElement?.parentElement === list)
            hide(region.parentElement, true);
        }
        const filesByPath = new Map(
          context.files.map((file) => [file.path, file])
        );
        const items = [
          ...document.querySelectorAll(
            '[role="tree"][aria-label="File Tree"] [role="treeitem"]'
          ),
        ];
        for (const item of items.filter(
          (node) => !node.hasAttribute("aria-expanded")
        )) {
          const file = filesByPath.get(item.id);
          hide(
            item,
            file && shouldHide(file, paths, includeUnclassified.checked)
          );
        }
        for (const item of items
          .filter((node) => node.hasAttribute("aria-expanded"))
          .reverse()) {
          const files = context.files.filter((file) =>
            file.path.startsWith(item.id + "/")
          );
          const leaves = [
            ...item.querySelectorAll('[role="treeitem"]:not([aria-expanded])'),
          ];
          hide(
            item,
            files.length > 0 &&
              leaves.length > 0 &&
              files.every((file) =>
                shouldHide(file, paths, includeUnclassified.checked)
              ) &&
              leaves.every((leaf) => leaf.hasAttribute(hiddenAttribute))
          );
        }
      }
    }
    controls.toggleAttribute("data-active", checkbox.checked);
    message(
      inline,
      checkbox.checked && excluded.length === context.files.length
        ? "No matching files"
        : ""
    );
    message(status, notice);
    positionPanel();
  };
  const fetchOwnership = async () => {
    if (disposed || pending || !context?.supported) return;
    const requestedKey = key;
    const requestedGeneration = generation;
    const wasAttempted = attempted;
    attempted = true;
    pending = true;
    checkbox.checked = false;
    paths = undefined;
    scopes = undefined;
    notice = "Loading PullApprove ownership…";
    apply();
    const isCurrent = () => {
      if (
        disposed ||
        generation !== requestedGeneration ||
        key !== requestedKey
      )
        return false;
      try {
        return currentDiff(document, location.href)?.key === requestedKey;
      } catch {
        return false;
      }
    };
    try {
      const response = await requestOwnership({
        type: "pullapprove-ownership",
        username: context.username,
      });
      // Navigation may precede the observer callback; check live metadata too.
      if (!isCurrent()) return;
      if (response?.error) throw new Error(response.error);
      if (
        !Array.isArray(response?.data?.paths) ||
        !response.data.paths.every(
          (item) =>
            item &&
            typeof item.path === "string" &&
            typeof item.owned === "boolean"
        )
      )
        throw new Error("Incomplete ownership response.");
      if (
        !Array.isArray(response.data.scopes) ||
        !response.data.scopes.every(
          (scope) =>
            scope &&
            typeof scope.name === "string" &&
            scope.name.length > 0 &&
            Array.isArray(scope.paths) &&
            scope.paths.every((path) => typeof path === "string")
        )
      )
        throw new Error("Incomplete scope response.");
      paths = new Map(
        response.data.paths.map((item) => [item.path, item.owned])
      );
      scopes = response.data.scopes;
      notice = wasAttempted ? "Ownership refreshed." : "";
      text(load, "Refresh ownership");
    } catch (error) {
      if (
        !disposed &&
        generation === requestedGeneration &&
        key === requestedKey
      ) {
        notice = `${
          error.message || "Could not load PullApprove ownership."
        } No files are excluded by PullApprove. Retry in Details.`;
        text(load, "Retry ownership");
      }
    } finally {
      if (
        !disposed &&
        generation === requestedGeneration &&
        key === requestedKey
      ) {
        pending = false;
        apply();
      }
    }
  };
  const sync = () => {
    frame = undefined;
    if (disposed) return;
    let next;
    try {
      next = currentDiff(document, location.href);
    } catch {
      next = null;
    }
    if (!next) {
      restore();
      controls.remove();
      generation++;
      key = undefined;
      context = undefined;
      paths = undefined;
      scopes = undefined;
      pending = false;
      attempted = false;
      checkbox.checked = false;
      includeUnclassified.checked = false;
      return;
    }
    context = next;
    const toolbar = [...document.querySelectorAll("h2")]
      .find((heading) => heading.textContent.trim() === "Pull request toolbar")
      ?.closest("section");
    if (toolbar && !controls.isConnected) {
      toolbar.querySelector(":scope > div")?.append(controls);
    }
    if (!style.isConnected) document.head.append(style);
    if (key !== next.key) {
      generation++;
      key = next.key;
      paths = undefined;
      scopes = undefined;
      pending = false;
      attempted = false;
      notice = "";
      checkbox.checked = false;
      includeUnclassified.checked = false;
      menu.open = false;
      text(load, "Refresh ownership");
    }
    link.href = `${pullapproveOrigin}/gh/${next.owner}/${next.repo}/pulls/${next.number}/`;
    fullDiff.href = `https://github.com/${next.owner}/${next.repo}/pull/${next.number}/changes`;
    fullDiff.hidden = next.supported;
    if (!next.supported) checkbox.checked = false;
    if (next.supported && !attempted && controls.isConnected)
      void fetchOwnership();
    else apply();
  };
  const changeFilter = () => {
    notice = "";
    sync();
  };
  checkbox.addEventListener("change", changeFilter);
  includeUnclassified.addEventListener("change", changeFilter);
  load.addEventListener("click", () => {
    // Re-read identity before a manual request, not just on the next frame.
    sync();
    void fetchOwnership();
  });
  const observer = new MutationObserver((mutations) => {
    if (mutations.every((mutation) => controls.contains(mutation.target)))
      return;
    if (frame === undefined) frame = requestAnimationFrame(sync);
  });
  observer.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  sync();
  return () => {
    disposed = true;
    generation++;
    observer.disconnect();
    document.removeEventListener("pointerdown", dismiss);
    document.removeEventListener("scroll", positionPanel, true);
    document.defaultView.removeEventListener("resize", positionPanel);
    menu.removeEventListener("toggle", positionPanel);
    menu.removeEventListener("focusout", leave);
    if (frame !== undefined) cancelAnimationFrame(frame);
    restore();
    controls.remove();
    style.remove();
  };
}
