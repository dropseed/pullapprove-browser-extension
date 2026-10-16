import { parsePullRequestPage } from "./components/page";
import { mountV3, unmountV3 } from "./components/v3";
import { mountV5, refreshV5, unmountV5 } from "./components/v5";

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
  mountV3();
  mountV5(page);
}

sync();
document.addEventListener("turbo:load", sync);
window.addEventListener("popstate", sync);
// The catch-all: the files tab routes client-side without either event above,
// and GitHub sometimes swaps the sidebar out on the same URL.
setInterval(sync, 1000);

// Coming back to a tab that's been sitting open: its PullApprove data may be
// stale. (Only v5 fetches live data; v3 reads report links off the page.)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshV5();
  }
});
window.addEventListener("focus", refreshV5);
