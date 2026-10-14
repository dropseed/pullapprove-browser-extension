// The Files changed tab: marks the files that are yours, and can hide the
// rest. "Yours" is the server's call (`file.yours`); nothing is decided here.
//
// GitHub's files view is a React app that renders file diffs as they scroll
// into view, so one observer re-applies both the marks and the filter on
// every DOM change. GitHub keys a file's diff and its tree row by the same
// `#diff-<digest>` anchor, so one lookup serves both.

import {
  SELECTORS,
  diffContainerDigest,
  diffDigest,
  filesViewIsPartial,
  reportIfStillMissing,
} from "../github";
import { statusOf } from "./status";
import { logoElement } from "./logo";

const ROW_CLASS = "pullapprove-files-controls";
const BUTTON_CLASS = "pullapprove-only-my-files";
const MARK_CLASS = "pullapprove-mark";
const HIDDEN_ATTR = "data-pullapprove-hidden";
const STORAGE_KEY = "pullapprove-only-my-files";

function selectSegment(item, selected) {
  item.classList.toggle("SegmentedControl-item--selected", selected);
  const button = item.querySelector("button");
  if (selected) {
    button.setAttribute("aria-current", "true");
  } else {
    button.removeAttribute("aria-current");
  }
}

export default class FilesTab {
  // `files` and `scopes` are the PullApprove payload's lists.
  constructor({ files, scopes }) {
    this.scopes = new Map(scopes.map((scope) => [scope.name, scope]));
    this.partial = filesViewIsPartial();

    // Only your files get touched: by digest for diffs and tree rows, by path
    // for tree rows, and every ancestor directory so the tree keeps the
    // folders your files live in.
    this.myFiles = new Map();
    this.myPaths = new Set();
    this.myDirs = new Set();
    const mine = files.filter((file) => file.yours);
    for (const file of mine) {
      this.myPaths.add(file.path);
      const parts = file.path.split("/");
      for (let depth = 1; depth < parts.length; depth++) {
        this.myDirs.add(parts.slice(0, depth).join("/"));
      }
    }

    this.hiddenAny = false;
    this.scheduled = false;
    this.observer = new MutationObserver(() => this.scheduleApply());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.scheduleApply();
    Promise.all(
      mine.map(async (file) => [await diffDigest(file.path), file])
    ).then((entries) => {
      this.myFiles = new Map(entries);
      this.scheduleApply();
    });
  }

  remove() {
    this.observer.disconnect();
    this.unhideAll();
    document.querySelectorAll(`.${ROW_CLASS}`).forEach((el) => el.remove());
    document.querySelectorAll(`.${MARK_CLASS}`).forEach((el) => el.remove());
  }

  scheduleApply() {
    if (this.scheduled) {
      return;
    }
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.apply();
    });
  }

  apply() {
    this.ensureButton();
    this.markFiles();
    this.applyFilter();
  }

  // --- Marks: a scope label on the file header, the mark on the tree row ---

  markFiles() {
    document.querySelectorAll(SELECTORS.diffContainers).forEach((diff) => {
      const file = this.myFiles.get(diffContainerDigest(diff));
      if (!file) {
        return;
      }
      const heading = diff.querySelector(SELECTORS.fileHeading);
      if (!heading) {
        reportIfStillMissing(
          "fileHeading",
          () => !diff.isConnected || diff.querySelector(SELECTORS.fileHeading)
        );
      } else if (!heading.parentElement.querySelector(`.${MARK_CLASS}`)) {
        heading.insertAdjacentElement("afterend", this.headerLabels(file));
      }
    });

    document.querySelectorAll(SELECTORS.treeFileLinks).forEach((link) => {
      const file = this.myFiles.get(link.hash.slice("#diff-".length));
      if (file && !link.parentElement.querySelector(`.${MARK_CLASS}`)) {
        link.insertAdjacentElement("afterend", this.treeMarker(file));
      }
    });
  }

  // Which of the file's scopes are yours, for display.
  myScopesOf(file) {
    return file.scopes.filter((name) => this.scopes.get(name)?.yours);
  }

  headerLabels(file) {
    const container = document.createElement("span");
    container.className = `${MARK_CLASS} d-inline-flex flex-items-center gap-1 ml-2`;
    for (const name of this.myScopesOf(file)) {
      const scope = this.scopes.get(name);
      const label = document.createElement("span");
      label.className = "Label Label--accent d-inline-flex flex-items-center";
      label.append(logoElement(12), document.createTextNode(name));
      label.firstChild.classList.add("mr-1");
      label.title = `Yours to review in PullApprove: ${name} (${statusOf(
        scope.status
      ).label.toLowerCase()})`;
      container.append(label);
    }
    return container;
  }

  // The tree is narrow, so just the mark; the scope names are in the tooltip.
  treeMarker(file) {
    const container = document.createElement("span");
    container.className = `${MARK_CLASS} color-fg-accent ml-1`;
    container.title = `Yours to review in PullApprove: ${this.myScopesOf(
      file
    ).join(", ")}`;
    container.append(logoElement(12));
    container.firstChild.style.verticalAlign = "middle";
    return container;
  }

  // --- Filter: "Only files in my scopes" ---

  // Hiding is only safe when GitHub is rendering the whole diff.
  get unavailableReason() {
    if (this.partial) {
      return "Available on the full diff only (not a selected commit, a single file, or a very large diff)";
    }
    if (this.myPaths.size === 0) {
      return "None of this pull request's files are in your PullApprove scopes";
    }
    return null;
  }

  // The preference lives in session storage; it only takes effect when the
  // filter is available.
  get active() {
    return (
      !this.unavailableReason && sessionStorage.getItem(STORAGE_KEY) === "1"
    );
  }

  setActive(active) {
    sessionStorage.setItem(STORAGE_KEY, active ? "1" : "0");
    this.apply();
  }

  // Below GitHub's file tree filter box: an "All files / Your scopes" toggle.
  // GitHub renders the filter box once for the sidebar tree and again in the
  // narrow layout's Files drawer, so each gets its own controls and they
  // share the state.
  ensureButton() {
    const filterBoxes = document.querySelectorAll(SELECTORS.fileTreeFilter);
    if (filterBoxes.length === 0) {
      reportIfStillMissing("fileTreeFilter", () =>
        document.querySelector(SELECTORS.fileTreeFilter)
      );
    }
    filterBoxes.forEach((anchor) => {
      if (!anchor.nextElementSibling?.classList.contains(ROW_CLASS)) {
        anchor.insertAdjacentElement("afterend", this.controls());
      }
    });

    const unavailable = this.unavailableReason;
    const active = this.active;
    document.querySelectorAll(`.${ROW_CLASS}`).forEach((row) => {
      const [all, mine] = row.querySelectorAll(".SegmentedControl-item");
      selectSegment(all, !active);
      selectSegment(mine, active);
      const mineButton = mine.querySelector("button");
      mineButton.disabled = Boolean(unavailable);
      mineButton.title =
        unavailable ||
        "Show only the files in your PullApprove scopes (separate from GitHub's CODEOWNERS filter)";
    });
  }

  // GitHub's own segmented control (Primer CSS, loaded on every page), so it
  // matches the filter box above it in both themes. "Mine" is GitHub's own
  // word for this (the comments sidebar); the PullApprove mark on it is what
  // separates it from GitHub's CODEOWNERS "Only files owned by you".
  controls() {
    const row = document.createElement("div");
    row.className = `${ROW_CLASS} mt-2`;

    // One-word labels, like GitHub's "All | Unresolved | Mine" in the comments
    // sidebar; the count rides on the option people are here for. Full width
    // to line up with the filter box above.
    const control = document.createElement("ul");
    control.className =
      "SegmentedControl SegmentedControl--small SegmentedControl--fullWidth";
    // github.com's own (React) segmented control draws a border around the
    // track that the CSS version here doesn't; this is the one difference.
    control.style.border = "1px solid var(--borderColor-default)";
    control.setAttribute("role", "list");
    control.setAttribute("aria-label", "PullApprove file filter");
    control.append(
      this.segment("All", false),
      this.segment(`Mine (${this.myPaths.size})`, true)
    );

    row.append(control);
    return row;
  }

  // The "Mine" segment carries the same mark as the files it keeps.
  segment(text, activates) {
    const item = document.createElement("li");
    item.className = "SegmentedControl-item";
    item.setAttribute("role", "listitem");

    const button = document.createElement("button");
    button.type = "button";
    button.className = `${BUTTON_CLASS} Button Button--invisible Button--small`;
    const content = document.createElement("span");
    content.className = "Button-content";
    if (activates) {
      const visual = document.createElement("span");
      visual.className = "Button-leadingVisual";
      visual.append(logoElement(12));
      content.append(visual);
    }
    const label = document.createElement("span");
    label.className = "Button-label";
    label.textContent = text;
    content.append(label);
    button.append(content);
    button.addEventListener("click", () => this.setActive(activates));

    item.append(button);
    return item;
  }

  applyFilter() {
    if (!this.active) {
      if (this.hiddenAny) {
        this.unhideAll();
      }
      return;
    }

    // The hideable unit is the entry wrapping each diff-<digest> container.
    document.querySelectorAll(SELECTORS.diffContainers).forEach((diff) => {
      const digest = diffContainerDigest(diff);
      if (digest && diff.parentElement) {
        this.setHidden(diff.parentElement, this.myFiles.has(digest));
      }
    });

    // Tree rows are addressed by path, directories by their path too.
    document.querySelectorAll(SELECTORS.treeItems).forEach((item) => {
      const isDirectory = item.hasAttribute("aria-expanded");
      const keep = isDirectory
        ? this.myDirs.has(item.id)
        : this.myPaths.has(item.id);
      this.setHidden(item, keep);
    });
  }

  setHidden(el, keep) {
    if (!keep) {
      el.style.display = "none";
      el.setAttribute(HIDDEN_ATTR, "");
      this.hiddenAny = true;
    } else if (el.hasAttribute(HIDDEN_ATTR)) {
      el.style.display = "";
      el.removeAttribute(HIDDEN_ATTR);
    }
  }

  unhideAll() {
    document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((el) => {
      el.style.display = "";
      el.removeAttribute(HIDDEN_ATTR);
    });
    this.hiddenAny = false;
  }
}
