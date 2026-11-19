import { parsePullRequestPage } from "./components/page";
import { mountV3, unmountV3 } from "./components/v3";
import { mountV5, unmountV5 } from "./components/v5";

// Both generations run side by side: a PR reviewed by PullApprove v3 has
// report links on the page for the v3 sidebar, and a PR on PullApprove 5 is
// found by the v5 lookup. Each renders nothing when it doesn't apply, and
// each returns early when it's already mounted, so sync is cheap to repeat.
function sync() {
  const page = parsePullRequestPage(window.location.pathname);
  if (!page) {
    unmountV3();
    unmountV5();
    return;
  }
  mountV3(page);
  mountV5(page);
}

sync();
// Turbo drives the classic pages; the React ones (the files tab, the
// Overview) route client-side and say so with soft-nav events instead.
document.addEventListener("turbo:load", sync);
document.addEventListener("soft-nav:end", sync);
window.addEventListener("popstate", sync);
// The catch-all: React re-renders the sidebar on the same URL without any
// event, and an event's sync can run before the new page has rendered. It's
// also what drives v5's poll.
setInterval(sync, 1000);
