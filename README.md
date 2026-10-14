# pullapprove-browser-extension

This browser extension embeds PullApprove information directly into GitHub and
adds an **Only files owned by you** filter to the current PR diff UI.

## Build and install locally

Use Node.js 22 or newer, then run from the repository root:

```sh
npm ci
./node_modules/.bin/parcel build content.js --no-cache --no-source-maps
node --test
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
and select the repository directory containing `manifest.json`, not `dist/`.
After rebuilding, click **Reload** on this extension's card in `chrome://extensions`,
then reload any open GitHub PR tabs. If switching from another unpacked directory,
remove the older copy first and use **Load unpacked** on this directory.
Disable other installed copies while testing an unpacked build to avoid duplicate
sidebars.
No browser restart is needed.

Sign in to both GitHub and `https://5.pullapprove.com` with the same GitHub
account. Open a PR's full **Files changed** / **All commits** view. Ownership
loads automatically once the supported diff metadata is ready, including on
GitHub page navigation. The visible **Only files owned by you** checkbox
in the top toolbar stays off until you select it. When on, it shows only files
with a positive PullApprove ownership match by default. It remains accessible
when the file tree is collapsed; uncheck it to stop excluding files.

**Details** lists every matching owned scope and the classified files it owns
in the current diff. A file may appear under multiple matching scopes. Scopes
with no matching classified files are listed with an empty-state message.
It also contains an optional **Include unclassified files** checkbox, a link
to the PullApprove report, and **Refresh ownership** or **Retry ownership**.
The unclassified option starts off for each PR/revision/view context; enabling
it also retains uncertain renames without a known ownership match. A failed
automatic request is not retried by page updates. Use Retry after signing in or
resolving the error. Refresh immediately turns filtering off and restores all
files excluded by this extension, even if the new request fails. A new snapshot
is never applied automatically. Clicking outside Details, moving keyboard focus
out of it, or pressing Escape dismisses it.

Scope lists describe PullApprove's classifications for the current diff, not
GitHub's final visible results. GitHub's search, extension and viewed-file filters
can narrow the result further. The checkbox indicates whether filtering is active;
there is no separate on/off label. If no files match, an inline empty-state message
appears and the toolbar checkbox remains available to restore the files without
clearing GitHub's own filters.

The worker requests access only to `https://5.pullapprove.com/*` in addition
to the existing GitHub content script. It uses the existing PullApprove login;
there is no PAT, cookie extraction, backend service, or analytics.

## Ownership filter limitations

- Ownership follows PullApprove v5's focus semantics, including resolved reviewer
  identities, alternates, prior reviewers, and files with matching code-level
  rules. Universal `*` eligibility alone does not make every file yours.
- Owned-only filtering excludes paths missing from PullApprove's classification.
  **Include unclassified files** opts into retaining them. Renames are included
  if either the old or new path is owned; otherwise uncertain renames follow the
  unclassified option. Native GitHub CODEOWNERS are not combined with PullApprove
  ownership.
- The current non-virtualized, all-files, full-PR diff is supported. Selected
  commit ranges, single-file mode, and virtualized/limited large diffs are not
  filtered. Positively identified commit-specific views show a disabled control
  and a link back to All commits. Older GitHub layouts or routes without verified
  PR identity are left alone and do not fetch ownership.
- **Freshness is unverified.** PullApprove's observed response does not identify
  the evaluated commit. Changing the PR, head revision, or commit range clears
  filtering and loaded ownership. A new supported diff context starts a new
  automatic fetch with filtering off;
  changes to PullApprove configuration or team membership require a manual refresh.
  Do not use this filter as evidence that a review is complete.
- The v5 workspace and report endpoints are undocumented. Format changes, expired
  sessions, and network errors leave all files visible rather than guessing.
- Automated runtime coverage checks an actual unpacked MV3 worker and a real
  cross-origin request in an isolated browser. Signed-in worker session reuse
  still needs manual validation after loading the rebuilt extension in an
  authenticated profile.

To package the locally built extension without creating a release:

```sh
zip -r pullapprove-browser-extension.zip dist img LICENSE manifest.json background.js ownership.js
```

The inherited `scripts/release` command commits, tags, pushes, and publishes;
it is not a local packaging command.

## Status sidebar

The extension also embeds PullApprove status information directly into the GitHub UI.

[![](https://storage.googleapis.com/chrome-gcs-uploader.appspot.com/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/UV4C4ybeBTsZt43U4xis.png)](https://chrome.google.com/webstore/detail/pullapprove/jfcmjfiigpabjhaacjpnlihifgfodjhj)

When viewing a pull request,
you'll see a summary of the PullApprove status at the top of the sidebar,
and can always click through to the full report for additional information.

![](example.png)
