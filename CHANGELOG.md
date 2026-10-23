# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-10-23

- The extension now authenticates with its own token for each browser instead of your PullApprove session cookie. You set it up once: the sidebar on a pull request asks you to connect, which opens PullApprove's connect page, and one click there connects that browser. This fixes Safari, where the session cookie never reached PullApprove.
- Adds the `storage` permission, which the extension uses to keep that token.
- To disconnect a browser, go to your account page on PullApprove. A token also expires after 30 days without being used, and the sidebar asks you to connect again.
- Incognito and private windows now share the normal windows' connection (one token per browser profile) instead of running a separate copy of the extension, which only made sense when the session cookie was the login.
- Runs in Firefox, as a separate build (`scripts/build-firefox`) whose manifest declares the background script the way Firefox needs it, plus the add-on id and data collection declaration AMO requires (the token it sends to PullApprove, and which pull requests you view).

## [0.4.2] - 2026-10-15

- The PullApprove 5 sidebar and Files changed marks now stay current without a page reload. While a pull request's tab is visible the extension checks PullApprove every 15 seconds, so reviews, approvals, and next steps show up on their own; a tab you aren't looking at makes no requests and catches up within a second of being looked at again. Marking a pull request ready for review, back to draft, merged, or closed is picked up right away.
- A PullApprove deploy or a dropped connection no longer blanks the sidebar or the Files changed marks; the last answer stays up until a new one arrives.

## [0.4.1] - 2026-10-15

- The PullApprove 5 sidebar and the Files changed marks now update without a page reload. They refresh when GitHub shows the pull request changing state (draft, ready, merged, closed) or PullApprove posting a new status, and when you come back to a tab that's been sitting open. Previously a pull request marked ready for review kept showing "Draft" until the page was refreshed.

## [0.4.0] - 2026-10-14

- PullApprove 5 support. On a pull request's Conversation tab the sidebar shows the review status, your next step, and your scopes, with a link to the pull request on PullApprove. On the Files changed tab, files in your scopes are marked, and an "All / Mine" toggle under the file filter hides everything else. Requires being logged in to PullApprove in the same browser.
- Adds a host permission for `5.pullapprove.com`, which the extension's background worker uses to ask PullApprove about the pull request with your session.
- PullApprove v3 report summaries still render as before (`components/v3`); the v5 code is separate (`components/v5`). An expired v3 report now says so instead of loading forever.

## [0.3.1] - 2026-02-18

- Fix for GitHub's new pull request checks UI.
- Fix avatar URLs for bot users.
- React 19.

## [0.3.0] - 2025-02-21

- Support for GitHub's new merge experience status box.

## [0.2.1] - 2025-01-13

- Remove the Primer dependency.

## [0.2.0] - 2025-01-13

- Manifest V3.

## [0.1.2] - 2021-05-23

- Observe the merge area for status changes instead of a removed GitHub element.

## [0.1.1] - 2021-01-21

Fix bug with PRs where "changes requested" panel is present.

## [0.1.0] - 2021-01-20

First release!

[Unreleased]: https://github.com/dropseed/pullapprove-browser-extension/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/dropseed/pullapprove-browser-extension/releases/tag/v0.4.0
[0.3.1]: https://github.com/dropseed/pullapprove-browser-extension/releases/tag/v0.3.1
[0.3.0]: https://github.com/dropseed/pullapprove-browser-extension/releases/tag/v0.3.0
[0.2.1]: https://github.com/dropseed/pullapprove-browser-extension/releases/tag/v0.2.1
[0.2.0]: https://github.com/dropseed/pullapprove-browser-extension/releases/tag/v0.2.0
[0.1.2]: https://github.com/dropseed/pullapprove-browser-extension/releases/tag/v0.1.2
[0.1.1]: https://github.com/dropseed/pullapprove-browser-extension/releases/tag/v0.1.1
[0.1.0]: https://github.com/dropseed/pullapprove-browser-extension/releases/tag/v0.1.0
