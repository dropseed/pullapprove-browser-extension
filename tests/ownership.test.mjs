import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ownershipReport,
  pullRequest,
  shouldHide,
  workspace,
} from "../ownership.js";

const viewer = { accounts: [{ username: "Alice", host_id: "42" }] };
const scope = (reviewers, extra = {}) => ({
  scope: { reviewers, alternates: [], code: [], ...extra },
  reviewer_states: {},
});
const path = (name, scopes) => ({ path: { path: name, scopes } });
const report = (scopes, paths, code = {}) => ({
  scope_results: scopes,
  path_results: paths,
  code_results: code,
});
const classify = (data) =>
  new Map(
    ownershipReport(data, viewer, "alice").paths.map((item) => [
      item.path,
      item.owned,
    ])
  );

test("focus includes resolved IDs, usernames, alternates and prior reviewers, but not wildcard eligibility", () => {
  const scopes = {
    id: scope(["42"]),
    username: scope(["ALICE"]),
    alternate: scope(["bob"], { alternates: ["alice"] }),
    reviewed: { ...scope(["bob"]), reviewer_states: { ALICE: "APPROVED" } },
    other: scope(["bob"]),
    anyone: scope(["*"]),
    unowned: scope([]),
  };
  const paths = Object.fromEntries(
    Object.keys(scopes).map((name) => [name, path(name, [name])])
  );
  assert.deepEqual(
    [...classify(report(scopes, paths))],
    [
      ["id", true],
      ["username", true],
      ["alternate", true],
      ["reviewed", true],
      ["other", false],
      ["anyone", false],
      ["unowned", false],
    ]
  );
});

test("joint ownership keeps a file when any applicable scope belongs to the viewer", () => {
  assert.equal(
    classify(
      report(
        { mine: scope(["alice"]), other: scope(["bob"]) },
        {
          "shared.py": path("shared.py", ["other", "mine"]),
        }
      )
    ).get("shared.py"),
    true
  );
});

test("code scopes own only files with matching code results, including code-only paths", () => {
  const data = report(
    { code: scope(["alice"], { code: ["special"] }) },
    {
      "matched.py": path("matched.py", ["code"]),
      "unmatched.py": path("unmatched.py", ["code"]),
    },
    {
      match: { code: { path: "matched.py", scopes: ["code"] } },
      codeOnly: { code: { path: "code-only.py", scopes: ["code"] } },
    }
  );
  assert.deepEqual(
    [...classify(data)],
    [
      ["matched.py", true],
      ["unmatched.py", false],
      ["code-only.py", true],
    ]
  );
});

test("scope breakdown includes each matching identity and only its classified paths", () => {
  const data = report(
    {
      id: scope(["42"]),
      username: scope(["ALICE"]),
      alternate: scope(["bob"], { alternates: ["alice"] }),
      reviewed: { ...scope(["bob"]), reviewer_states: { ALICE: "APPROVED" } },
      other: scope(["bob"]),
      anyone: scope(["*"]),
    },
    {
      "id.py": path("id.py", ["id"]),
      "shared.py": path("shared.py", ["username", "alternate", "other"]),
      "reviewed.py": path("reviewed.py", ["reviewed"]),
      "other.py": path("other.py", ["other"]),
      "anyone.py": path("anyone.py", ["anyone"]),
    }
  );
  assert.deepEqual(ownershipReport(data, viewer, "alice").scopes, [
    { name: "id", paths: ["id.py"] },
    { name: "username", paths: ["shared.py"] },
    { name: "alternate", paths: ["shared.py"] },
    { name: "reviewed", paths: ["reviewed.py"] },
  ]);
});

test("code-scoped files are deduplicated and unmatched code rules do not claim paths", () => {
  const data = report(
    {
      code: scope(["alice"], { code: ["special"] }),
      empty: scope(["alice"], { code: ["no matches"] }),
      path: scope(["alice"]),
    },
    {
      "matched.py": path("matched.py", ["code", "path"]),
      "unmatched.py": path("unmatched.py", ["code", "empty"]),
      "path.py": path("path.py", ["path"]),
    },
    {
      first: { code: { path: "matched.py", scopes: ["code"] } },
      second: { code: { path: "matched.py", scopes: ["code"] } },
      codeOnly: { code: { path: "code-only.py", scopes: ["code"] } },
    }
  );
  const result = ownershipReport(data, viewer, "alice");
  assert.deepEqual(result.scopes, [
    { name: "code", paths: ["matched.py", "code-only.py"] },
    { name: "empty", paths: [] },
    { name: "path", paths: ["matched.py", "path.py"] },
  ]);
  assert.deepEqual(
    result.paths.filter((entry) => entry.owned).map((entry) => entry.path),
    ["matched.py", "path.py", "code-only.py"]
  );
  assert.deepEqual(
    [...new Set(result.scopes.flatMap((entry) => entry.paths))].sort(),
    result.paths
      .filter((entry) => entry.owned)
      .map((entry) => entry.path)
      .sort()
  );
});

test("no matching scopes produces an empty breakdown and no owned files", () => {
  const result = ownershipReport(
    report(
      { other: scope(["bob"]) },
      { "other.py": path("other.py", ["other"]) }
    ),
    viewer,
    "alice"
  );
  assert.deepEqual(result, {
    paths: [{ path: "other.py", owned: false }],
    scopes: [],
  });
});

test("owned-only is the default and unclassified files require an explicit opt-in", () => {
  const paths = new Map([
    ["schema.graphql", true],
    ...Array.from({ length: 10 }, (_, index) => [`other-${index}.py`, false]),
  ]);
  const files = [
    "schema.graphql",
    "shared.py",
    "helper.py",
    "manifest.yml",
    "notes.txt",
    ...Array.from({ length: 10 }, (_, index) => `other-${index}.py`),
  ].map((path) => ({ path }));
  const visible = (includeUnclassified) =>
    files
      .filter((file) => !shouldHide(file, paths, includeUnclassified))
      .map((file) => file.path);

  assert.deepEqual(visible(), ["schema.graphql"]);
  assert.deepEqual(visible(false), ["schema.graphql"]);
  assert.deepEqual(visible(true), [
    "schema.graphql",
    "shared.py",
    "helper.py",
    "manifest.yml",
    "notes.txt",
  ]);
});

test("renames retain either owned path and include uncertain paths only when requested", () => {
  const paths = new Map([
    ["mine.py", true],
    ["old.py", true],
    ["new.py", false],
    ["other.py", false],
  ]);
  const cases = [
    { file: { path: "mine.py" }, strictHidden: false, inclusiveHidden: false },
    { file: { path: "other.py" }, strictHidden: true, inclusiveHidden: true },
    {
      file: { path: "missing.py" },
      strictHidden: true,
      inclusiveHidden: false,
    },
    {
      file: { path: "new.py", previousPath: "old.py", changeType: "RENAMED" },
      strictHidden: false,
      inclusiveHidden: false,
    },
    {
      file: {
        path: "mine.py",
        previousPath: "other.py",
        changeType: "RENAMED",
      },
      strictHidden: false,
      inclusiveHidden: false,
    },
    {
      file: { path: "mine.py", changeType: "RENAMED" },
      strictHidden: false,
      inclusiveHidden: false,
    },
    {
      file: { path: "new.py", changeType: "RENAMED" },
      strictHidden: true,
      inclusiveHidden: false,
    },
    {
      file: { path: "new.py", previousPath: "other.py", changeType: "RENAMED" },
      strictHidden: true,
      inclusiveHidden: true,
    },
    {
      file: {
        path: "new.py",
        previousPath: "missing.py",
        changeType: "RENAMED",
      },
      strictHidden: true,
      inclusiveHidden: false,
    },
    {
      file: {
        path: "missing.py",
        previousPath: "other.py",
        changeType: "RENAMED",
      },
      strictHidden: true,
      inclusiveHidden: false,
    },
  ];
  for (const { file, strictHidden, inclusiveHidden } of cases) {
    assert.equal(shouldHide(file, paths), strictHidden, file.path);
    assert.equal(shouldHide(file, paths, true), inclusiveHidden, file.path);
  }
});

test("no owned paths gives an empty owned-only result without broadening to other owners", () => {
  const paths = new Map([["other.py", false]]);
  assert.equal(shouldHide({ path: "other.py" }, paths), true);
  assert.equal(shouldHide({ path: "missing.py" }, paths), true);
  assert.equal(shouldHide({ path: "other.py" }, paths, true), true);
  assert.equal(shouldHide({ path: "missing.py" }, paths, true), false);
});

test("incomplete, errored, disabled and unevaluated reports cannot hide files", () => {
  const valid = report(
    { other: scope(["bob"]) },
    { "a.py": path("a.py", ["other"]) }
  );
  for (const data of [
    {},
    { ...valid, code_results: null },
    { ...valid, scope_results: { other: null } },
    {
      ...valid,
      code_results: { bad: { code: { path: "a.py", scopes: ["missing"] } } },
    },
    { ...valid, no_verdict: "processing" },
    { ...valid, repo_disabled: true },
    {
      ...valid,
      scope_results: {
        other: { ...scope(["bob"]), error_message: "invalid config" },
      },
    },
    report({ other: scope(["bob"]) }, { "a.py": path("a.py", ["missing"]) }),
    report(
      { other: scope(["bob"]) },
      { "a.py": path("different.py", ["other"]) }
    ),
  ])
    assert.throws(() => classify(data));
  assert.throws(() => ownershipReport(valid, viewer, "bob"), /GitHub account/);
});

test("workspace parsing decodes the account and restricts the endpoint to the report API", () => {
  const endpoint =
    "/internal/api/pullrequests/11111111-2222-3333-4444-555555555555/";
  const html = `<div id="diff-workspace" data-pullrequest-url="${endpoint}" data-viewer="{&quot;accounts&quot;:[{&quot;username&quot;:&quot;Alice&quot;,&quot;host_id&quot;:&quot;42&quot;}]}"></div>`;
  assert.deepEqual(workspace(html), { endpoint, viewer });
  assert.throws(() => workspace("<html>Sign in</html>"), /Sign in/);
  assert.throws(
    () =>
      workspace(
        html.replace('id="diff-workspace"', 'data-id="diff-workspace"')
      ),
    /Sign in/
  );
  assert.throws(
    () => workspace(html.replace(endpoint, "https://example.com/private")),
    /endpoint/
  );
});

test("only GitHub full PR diff routes identify a request target", () => {
  assert.deepEqual(
    pullRequest("https://github.com/example/project/pull/12/changes?foo=bar"),
    {
      owner: "example",
      repo: "project",
      number: "12",
    }
  );
  assert.notEqual(
    pullRequest("https://github.com/example/project/pull/12/files"),
    null
  );
  for (const url of [
    undefined,
    null,
    "not a url",
    "https://github.com.evil.test/example/project/pull/12/changes",
    "https://github.com/example/project/pull/12",
    "https://github.com/example/project/pull/12/changes/abc..def",
    "https://github.com/example/project/pull/0/files",
    "https://github.com/example/%2fprivate/pull/12/changes",
  ])
    assert.equal(pullRequest(url), null);
});
