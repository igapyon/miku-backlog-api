# Open Issue Implementation Plan

This document is the execution plan for the open GitHub Issues in
`igapyon/miku-backlog-api`. It is written so that a future AI Agent can select
the next work item without rediscovering scope, ordering, or safety boundaries.

## Planning Snapshot

- checked date: 2026-08-15
- baseline commit: `813be5988e0cdf50939f8302ae3a13ed863207f8`
- product version: `0.7.1`
- upstream compatibility baseline: `backlog-mcp-server@0.14.0`
- current operation inventory: 62 upstream operations and 1 local operation
- baseline verification: `npm test` passed all 50 tests and
  `npm run smoke:node` passed on 2026-08-15

Open Issues at this snapshot:

| Order | Issue | Planned outcome |
| --- | --- | --- |
| 1 | [#26](https://github.com/igapyon/miku-backlog-api/issues/26) representative upstream differential tests | Verify the already-present implementation and close the Issue without duplicating tests. |
| 2 | [#20](https://github.com/igapyon/miku-backlog-api/issues/20) efficient non-Closed Issue lookup | Add a project-status READ operation and document the deterministic non-Closed resolution rule. |
| 3 | [#4](https://github.com/igapyon/miku-backlog-api/issues/4) organization discovery | Add local organization metadata after the local-operation infrastructure has been generalized by #20. |
| 4 | [#5](https://github.com/igapyon/miku-backlog-api/issues/5) dependency reduction | Make a separate dependency-boundary decision after the functional contracts are stable. |

Do not combine these Issues into one implementation change. Finish, verify,
and review each Issue before starting the next one.

## Execution Record — 2026-08-15

The planning snapshot above is retained as the starting state. Local execution
completed with 62 upstream operations and three product-owned local operations:
`get_project_statuses`, `get_rate_limit`, and `list_organizations`.

- `npm run typecheck` passed.
- `npm run trace:refresh` regenerated the mapping from the checked
  `v0.14.0` upstream checkout.
- `npm test` passed all 54 tests.
- `npm run smoke:node` passed.

GitHub comments, Issue closure, commits, and pushes are intentionally not part
of this local execution record. They require a separately approved SCM action.

## Rules for Every Work Item

1. Start from a clean worktree and record `git status --short --branch` and the
   current commit.
2. Use one branch and one reviewable change for one Issue. Do not mix a version
   increment, Release publication, or unrelated maintenance into the change.
3. Keep TypeScript under `src/` as the source of truth. Do not hand-edit
   generated `dist/` or `bundle/` files.
4. Preserve all upstream operation names, schemas, handler behavior, and trace
   records. Mark every new product-owned operation with
   `origin: "miku-backlog-api"`.
5. Classify every operation explicitly as READ, CREATE, UPDATE, or DELETE.
   The operations planned here are READ operations.
6. Preserve the JSON envelope, `fields`, dry-run, organization selection,
   permission, verbose-event, and error-diagnostic contracts unless an Issue
   explicitly changes one of them.
7. Never expose API keys, request or response bodies, organization secrets, or
   unreviewed environment values in output, diagnostics, traces, or tests.
8. Update hard-coded operation counts and local-operation mapping assertions
   whenever a new local operation is added.
9. Run `npm run trace:refresh` only when the intended upstream checkout exists
   at `workplace/upstream/backlog-mcp-server` and the generated mapping change
   is understood. Do not edit the generated mapping as an isolated shortcut.
10. Before handoff, run the verification commands specified for the work item,
    review the complete diff, and confirm that no unrelated file changed.
11. GitHub comments, Issue closure, branch push, PR creation, tags, and Releases
    are separate SCM actions. Do not perform them merely because local work
    passes.

## Stage 1: Verify and Complete Issue #26

### Existing Evidence

The requested implementation already exists:

- `tests/upstream-differential.test.mjs` compares representative READ, CREATE,
  UPDATE, and DELETE operations through the upstream composed MCP handler and
  the Node runner.
- It compares transformed API-call arguments, selected organization, result
  data, field selection, identifier fallback, and Backlog error messages.
- `docs/traceability/cli-json-parity.md` records intentional MCP-versus-Node
  differences.
- `docs/traceability/upstream-test-mapping.md` records the test layers.
- `docs/traceability/upstream-followup-log.md` records the compatibility work.

### Execution

1. Confirm the files above still describe the current implementation.
2. Run `npm test` and `npm run smoke:node`.
3. Map every #26 completion condition to one test or traceability paragraph.
4. If all checks pass, make no redundant source change. Prepare a concise Issue
   comment containing the evidence and verification result, then close #26
   through a separately approved SCM workflow.
5. If a condition is genuinely missing, add only the missing test or
   traceability statement and rerun both commands.

### Completion Gate

- Representative CRUD parity runs automatically.
- An unintended result or Backlog-call argument difference fails the tests.
- Intentional Node-only differences are documented.
- Full test and bundle smoke commands pass.

### Execution Result

The existing representative differential tests and traceability records met
this gate. No redundant source test was added. The remaining action is an
externally approved GitHub evidence comment and Issue-state update.

## Stage 2: Implement Issue #20

### Fixed Product Semantics

Add a local READ operation named `get_project_statuses`.

Input:

- accept `projectId` or `projectKey` using the same resolution behavior as the
  existing `get_project` operation;
- accept the standard top-level `organization` and `fields` properties;
- reject input when neither project identifier is usable.

Behavior:

- invoke `backlog-js#getProjectStatuses(projectIdOrKey)` exactly once;
- return the Backlog status records through the ordinary JSON envelope;
- classify the operation as READ;
- preserve multi-organization selection and sanitized verbose metadata;
- record the operation as product-owned, not as an upstream MCP operation.

For this plan, "completed" means the terminal Backlog `Closed` column. Resolve
it as the unique status with the greatest numeric `displayOrder`. Nulab's
[project-settings contract](https://support.nulab.com/hc/en-us/articles/8616310170009-Backlog-101-Project-settings)
keeps `Open` at the top and `Closed` at the bottom. The
[status-list API](https://developer.nulab.com/docs/backlog/api/2/get-status-list-of-project/)
returns only `id`, `projectId`, `name`, `color`, and `displayOrder`; it has no
explicit closed-category field. Do not compare localized names, colors, or
fixed IDs.

The `useResolvedForChart` project setting is deliberately outside this rule.
It changes chart treatment of `Resolved` and later statuses; it does not change
the meaning of the terminal `Closed` status used by this plan. If the product
owner instead wants chart-closed semantics, stop and open a separate design
decision because the status-list response has no explicit closed-category
field.

The downstream fixed runner can then:

1. call `get_project_statuses` for one project and organization;
2. require a non-empty list and one unique greatest `displayOrder` value;
3. collect every other status ID in returned display order;
4. pass those IDs to the existing `get_issues.statusId` filter; and
5. fail explicitly instead of fetching every Issue when the terminal status
   cannot be resolved safely.

This keeps server-side filtering in Backlog while avoiding a second, broader
Node operation that duplicates the upstream `get_issues` schema.

### Implementation Files

- `src/core/local-tools.ts`: add the Zod input/output contract and handler.
- `src/core/catalog.ts`: add READ policy and a discovery example.
- `src/core/operation-input-constraints.ts`: add the project ID/key constraint.
- `scripts/generate-upstream-tool-mapping.mjs`: replace the one-off
  `get_rate_limit` branch with an explicit map of supported local operations,
  source files, and target tests.
- `tests/access-policy-and-rate-limit.test.mjs` or a renamed local-operation
  test file: cover handler calls, schema, fields, permissions, trace, verbose
  metadata, and organization selection.
- `tests/node-runtime.test.mjs`, `tests/node-cli.test.mjs`, and
  `scripts/smoke-node.mjs`: update inventory and discovery assertions.
- `README.md`, `docs/development.md`, and traceability documents: document the
  operation, its local origin, and the terminal-status rule.
- `docs/traceability/upstream-tool-mapping.json`: regenerate after the mapping
  generator supports all local operations.

Before regeneration, provide the ignored upstream checkout at
`workplace/upstream/backlog-mcp-server` and verify that it is exactly tag
`v0.14.0`, commit `9da42fcfb5b69f1455e3864c49f2b57a45a4cbe9`. If that
checkout is unavailable, stop before changing the generated mapping rather
than hand-editing it.

### Required Tests

- project ID and project key each reach `getProjectStatuses` unchanged;
- a non-positive project ID falls back to `projectKey`, matching existing
  upstream identifier resolution;
- missing identifiers fail before Backlog access;
- named organization selection reaches the correct mocked client;
- READ permission is sufficient and no write permission is requested;
- `fields` selection works on the returned list;
- verbose output contains only allowlisted project identifiers and access
  metadata;
- trace origin, source, and target test are product-owned and deterministic;
- catalog, trace, CLI, runtime bundle, and operation counts include the new
  local operation.

Downstream handoff tests, which do not belong in this repository change, must
prove that localized and custom status names still resolve the final status
solely by greatest `displayOrder`, and that empty or tied terminal-order
fixtures fail explicitly.

### Verification

```bash
npm run typecheck
npm test
npm run smoke:node
git diff --check
git status --short
```

Do not update the sister `miku-backlog-api-skills` repository in this change.
After a Release containing this operation exists, implement its one-call fixed
runner there as a separately reviewed downstream task.

### Execution Result

`get_project_statuses` is implemented as a product-owned READ operation. It
validates a project ID/key before resolving a Backlog client, preserves normal
organization selection and `fields` projection, and maps directly to
`getProjectStatuses`. The local-operation trace mapping and CLI/runtime
inventory include it.

## Stage 3: Implement Issue #4

### Fixed Product Semantics

Add a local READ operation named `list_organizations`. It inspects validated
local connection configuration and performs no Backlog API request.

Its input is an empty object plus the standard optional `fields` projection.
Do not advertise or silently ignore `organization` for this operation: reject
it because the operation lists all configured organizations rather than
selecting one.

Output records contain exactly:

- `name`;
- `domain`; and
- `isDefault`.

Never return API keys or original environment variable names. Sort records by
organization name using UTF-16 code-unit order so output is deterministic.
For legacy single-organization configuration, return one record named
`default` with `isDefault: true`.

### Architecture

1. Extend `BacklogClientRegistry` with `listOrganizations()` and implement it
   for both single- and multi-organization configurations.
2. Refactor local-tool construction so a local metadata tool can receive the
   validated registry while API-backed tools continue to receive the selected
   Backlog client.
3. Keep metadata discovery credential-free. Actual `list_organizations`
   execution validates configuration but does not select a client or emit a
   fake Backlog access event.
4. Preserve `fields` projection on the returned records. Document that
   `--verbose` produces no API-access event because no API access occurs.
5. Add this operation to the generalized local trace mapping introduced in
   Stage 2.

### Required Tests

- single configuration returns only `default`;
- multi-organization output is sorted and marks exactly one default;
- incomplete pairs, missing default, and unknown default fail with structured
  configuration diagnostics;
- no API key or secret environment value appears in output or errors;
- no Backlog client method or fetch is invoked;
- dry-run validates an empty input without resolving configuration;
- `fields` can select `name` and `isDefault`;
- catalog, trace, CLI, runtime bundle, and operation counts include the new
  local operation.

### Verification

Run the same verification commands as Stage 2. Also run focused tests with
synthetic environment objects; do not use or print a real local connection
file.

### Execution Result

`list_organizations` is implemented as a product-owned READ operation. It
validates configuration, deterministically returns only `name`, `domain`, and
`isDefault`, rejects a selected `organization`, and does not access Backlog or
emit an API-access verbose event. Tests cover single and multi-organization
configuration, `fields`, dry-run, configuration failures, and secret absence.

## Stage 4: Decide and Implement Issue #5

### Current Dependency Evidence

`backlog-mcp-server@0.14.0` is a production dependency because this project
imports its published schemas, tool factories, composed-handler test helpers,
field selection, and error parsing. Its dependency declaration installs MCP,
Hono, configuration, logging, CLI, and GraphQL packages even though esbuild
correctly excludes MCP and HTTP modules from the generated runtime bundles.

The currently observed unused-at-runtime direct transitive dependencies of
`backlog-mcp-server` include `@modelcontextprotocol/sdk`, `@hono/node-server`,
`hono`, `cosmiconfig`, `env-var`, `pino`, `pino-pretty`, and `yargs`. `graphql`
is used by the current field-selection implementation and must not be assumed
unused.

### Decision Gate

Do not manually delete lockfile entries, rely on an undocumented partial npm
installation, or deep-import a package that is no longer declared. Choose one
of these explicit outcomes:

1. Preferred: upstream publishes a transport-free handler/core package or
   makes transport dependencies optional, and this repository migrates to that
   supported package.
2. Local conversion: copy only the required audited handler/core source into
   this repository, preserve file-level upstream mapping and MIT notices, and
   remove `backlog-mcp-server` only after differential parity proves the local
   conversion.
3. Accepted exception: retain the dependency and document that installation
   size is the cost of consuming the supported published handler boundary.

Before choosing option 2, inventory every imported upstream module and its
recursive imports, including test-only imports. Record the maintenance cost of
future upstream compatibility refreshes. Prefer option 1 when it is available
on a reasonable schedule.

### Acceptance and Verification

- update the stale Issue wording from "58 operations" to the current baseline
  of 62 upstream operations plus all product-owned local operations;
- compare a clean `npm ci` dependency tree and install size before and after;
- run typecheck, all differential and runtime tests, and bundle smoke tests;
- confirm generated bundles still exclude MCP and HTTP server modules;
- confirm source mapping, licenses, `THIRD_PARTY_NOTICES.md`, and source archive
  contents remain correct;
- confirm the sister runtime consumer can still import the public runtime
  bundle before releasing;
- do not combine this dependency migration with an upstream version refresh.

If no supported reduction path preserves traceability and parity, close the
Issue only after documenting the accepted exception and evidence; do not claim
that bundle tree-shaking reduced installed dependencies.

### Decision Record

Outcome 3, accepted exception, applies for the pinned `v0.14.0` compatibility
baseline. The official package manifest publishes only `build/` and declares
the MCP, HTTP, configuration, logging, CLI, and GraphQL dependencies as
production dependencies. This project intentionally imports published handler
modules, field selection, and error handling from that supported boundary.

The generated Node bundles already exclude the transport/server modules, but
that does not reduce installed dependency size. No separately published
transport-free upstream boundary was adopted in this change, and a local
conversion would require an independent import inventory, license review, and
differential-parity migration. Therefore this change makes no dependency or
lockfile modification and does not combine the decision with an upstream
version refresh. The GitHub Issue remains for a separately approved evidence
comment and state decision.

## Final Completion Sequence

For each Stage:

1. implement or verify locally;
2. run the specified checks;
3. review the diff and public-contract changes;
4. commit through the repository's SCM workflow;
5. prepare and review PR text;
6. merge and publish only through separately authorized human-controlled
   operations;
7. verify the merged or released artifact when the Issue requires it; and
8. comment on and close the GitHub Issue with exact evidence.

After #20 is released, create a downstream handoff for
`miku-backlog-api-skills` containing the version, commit, Release asset, and
SHA-256. Do not start downstream mutation from an unreleased local bundle.
