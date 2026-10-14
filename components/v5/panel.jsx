import React from "react";
import { statusOf, STATUSES } from "./status";
import { Logo } from "./logo";

// The sidebar answers one question for the viewer: what does this PR need
// from me? Status, your next step, your scopes. Everything else is a click
// away on PullApprove.

const Icon = ({ status }) => {
  const { color, icon, label } = statusOf(status);
  return (
    <svg
      className={color}
      fill="currentColor"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-label={label}
    >
      <title>{label}</title>
      <path d={icon} />
    </svg>
  );
};

const NO_VERDICT_LABELS = {
  repo_disabled: "This repo isn't being processed by PullApprove",
  awaiting_first_run: "Waiting for PullApprove to process this pull request",
  closed_unprocessed: "Closed before PullApprove processed it",
  run_failed: "PullApprove hit an error processing this pull request",
  empty: "Nothing to review",
};

function StatusFlash({ data }) {
  const state = data.status.state;
  if (!state) {
    const label =
      data.status.description ||
      NO_VERDICT_LABELS[data.no_verdict] ||
      "No review verdict yet";
    return <div className="flash p-2 mb-3">{label}</div>;
  }
  const status = STATUSES[state];
  return (
    <div className={`${status ? status.flash : "flash"} p-2 mb-3`}>
      <span className="text-bold">{status ? status.label : state}</span>
      {data.status.description ? ` — ${data.status.description}` : null}
    </div>
  );
}

function YourNextSteps({ steps }) {
  const yours = steps.filter((step) => step.yours);
  if (yours.length === 0) {
    return null;
  }
  return (
    <div className="mb-3">
      <div className="text-bold mb-1">Your next step</div>
      {yours.map((step, index) => (
        <div key={index}>{step.label}</div>
      ))}
    </div>
  );
}

function Scope({ scope }) {
  return (
    <div className="d-flex flex-items-center flex-justify-between mb-1">
      <code>{scope.name}</code>
      <div className="d-flex flex-items-center">
        <span className="color-fg-muted mr-2">
          {scope.points}/{scope.require}
        </span>
        <Icon status={scope.status} />
      </div>
    </div>
  );
}

function YourScopes({ scopes, url }) {
  if (scopes.length === 0) {
    return null;
  }
  const mine = scopes.filter((scope) => scope.yours);
  const others = scopes.length - mine.length;
  return (
    <div className="mb-3">
      {mine.length > 0 ? (
        <div className="text-bold mb-1">Your scopes</div>
      ) : null}
      {mine.map((scope) => (
        <Scope key={scope.name} scope={scope} />
      ))}
      {others > 0 ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="color-fg-muted"
        >
          {mine.length > 0
            ? `${others} other scope${others === 1 ? "" : "s"}`
            : `${others} scope${others === 1 ? "" : "s"}, none yours`}
        </a>
      ) : null}
    </div>
  );
}

// Wraps content in a sidebar item, plus an empty one so the divider styling
// matches GitHub's own sidebar items.
function SidebarItem({ link, children }) {
  return (
    <div>
      <div className="discussion-sidebar-item">
        <div className="discussion-sidebar-heading text-bold d-flex flex-items-center flex-justify-between">
          <span className="d-inline-flex flex-items-center">
            <Logo size={14} className="mr-1" />
            PullApprove
          </span>
          {link}
        </div>
        {children}
      </div>
      <div className="discussion-sidebar-item"></div>
    </div>
  );
}

const STORE_URL =
  "https://chrome.google.com/webstore/detail/pullapprove/jfcmjfiigpabjhaacjpnlihifgfodjhj";

export default function Panel({ response }) {
  const { status, json, data, baseUrl } = response;

  if (status === 401) {
    return (
      <SidebarItem>
        <div className="flash p-2">
          <a href={baseUrl} target="_blank" rel="noreferrer">
            Log in to PullApprove
          </a>{" "}
          to see this pull request's review status here.
        </div>
      </SidebarItem>
    );
  }

  if (status === 426) {
    // This build is older than the server will answer.
    return (
      <SidebarItem>
        <div className="flash flash-warn p-2">
          <a href={STORE_URL} target="_blank" rel="noreferrer">
            Update the PullApprove extension
          </a>{" "}
          to see this pull request's review status here.
        </div>
      </SidebarItem>
    );
  }

  if (status === 404 && !json) {
    // The server doesn't have the extension endpoint at all: a self-hosted
    // PullApprove that predates it. A JSON 404 is a PR we can't see (not a
    // PullApprove repo, or no access) and renders nothing.
    return (
      <SidebarItem>
        <div className="flash flash-warn p-2">
          This PullApprove server doesn't support the extension yet.
        </div>
      </SidebarItem>
    );
  }

  if (status !== 200 || !data) {
    // Network failures also render nothing; v5/index.js logs them.
    return null;
  }

  return (
    <SidebarItem
      link={
        <a href={data.url} target="_blank" rel="noreferrer">
          Open
        </a>
      }
    >
      <StatusFlash data={data} />
      <YourNextSteps steps={data.next_steps} />
      <YourScopes scopes={data.scopes} url={data.url} />
    </SidebarItem>
  );
}
