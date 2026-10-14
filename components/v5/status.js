// PullApprove's Status vocabulary, rendered in GitHub's own classes so it
// follows the light and dark themes. One table for the sidebar and the files
// tab, so a new status is added in one place.

const CHECK =
  "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z";
const DOT = "M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z";
const X =
  "M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z";

export const STATUSES = {
  PASS: {
    label: "Passed",
    flash: "flash flash-success",
    color: "color-fg-success",
    icon: CHECK,
  },
  WAIVED: {
    label: "Waived",
    flash: "flash flash-success",
    color: "color-fg-success",
    icon: CHECK,
  },
  PENDING: {
    label: "Pending",
    flash: "flash flash-warn",
    color: "color-fg-attention",
    icon: DOT,
  },
  FAIL: {
    label: "Failed",
    flash: "flash flash-error",
    color: "color-fg-danger",
    icon: X,
  },
  ERROR: {
    label: "Error",
    flash: "flash flash-error",
    color: "color-fg-danger",
    icon: X,
  },
};

// An unknown status (a newer server) renders as pending rather than crashing.
export function statusOf(state) {
  return STATUSES[state] || STATUSES.PENDING;
}
