# Upstream Follow-Up Log

## 2026-09-05 — Archive File and Attachment Downloads

- added product-owned READ operations for project shared-file directory
  metadata and streamed issue attachment, Wiki attachment, and shared-file
  download responses
- retained the ordinary JSON envelope for directory metadata, while keeping
  binary transfers in the separate `openDownload` Node API and `download` CLI
  command so bytes can never mingle with JSON output
- use transfer completion, not response-header arrival, to emit a verbose
  success outcome; capture the response HTTP and rate-limit metadata already
  available from the scoped Backlog fetch wrapper
- write file destinations through unique sibling `.part` files and atomically
  create the destination after a successful transfer; refuse existing paths

## 2026-09-05 — Upstream Output Metadata Contract

- accepted v0.18.0's removal of recursive output value schemas without a Node
  compatibility layer
- expose `outputFields` for upstream operations and reserve
  `outputFieldSchema` for Node-specific operations that define an actual output
  schema

## 2026-08-16 — v0.18.0 Compatibility Refresh

- pinned `backlog-mcp-server@0.18.0` and checked upstream tag `v0.18.0` at
  commit `1ca465a97d4ec09b96c7b4bece5135004454d2b8`
- regenerated the mapping against the exact upstream checkout and retained the
  62 upstream-operation / three local-operation inventory
- replaced deep `build/` imports with the package's supported root library API
- retained nested GraphQL-style `fields` as a Node-only compatibility layer;
  v0.18.0 exposes list-only field arrays and untyped output field names
- verified representative CRUD handler parity, root-import resolution, and
  exclusion of MCP and HTTP server modules from generated Node bundles

## 2026-08-15 — Local Open-Issue Contracts

- re-ran the representative upstream differential suite for Issue #26; no
  redundant source change was required
- added product-owned READ operation `get_project_statuses` for Issue #20,
  including project ID/key validation, `fields` projection, and direct
  `getProjectStatuses` invocation
- documented the downstream terminal-status rule: use the unique greatest
  `displayOrder`, not a status name, color, or fixed ID
- added product-owned READ operation `list_organizations` for Issue #4; it
  validates local configuration and exposes only sorted `name`, `domain`, and
  `isDefault` metadata without a Backlog API call
- generalized local-operation trace mapping; the generated inventory is now
  62 upstream operations plus three local operations
- retained `backlog-mcp-server@0.14.0` as the supported handler boundary for
  Issue #5. Its published package exposes `build/` and declares its transport
  dependencies; no local conversion or upstream-version refresh is included in
  this change.

## 2026-07-31 — v0.14.0 Compatibility Refresh

- pinned npm packages `backlog-mcp-server@0.14.0` and `backlog-js@0.19.0`
- checked upstream tag `v0.14.0` at commit
  `9da42fcfb5b69f1455e3864c49f2b57a45a4cbe9`
- regenerated mappings for 62 upstream normal tools plus the Node-specific
  `get_rate_limit` operation
- exposed `update_issue_comment`, `get_related_issues`, `add_related_issue`,
  and `remove_related_issue` with explicit READ/CREATE/UPDATE/DELETE policy
  and destructive confirmation for relation removal
- preserved `update_issue.parentIssueId` and non-positive `issueId` fallback to
  `issueKey` through the upstream handlers
- added differential coverage for all new and changed issue operations and
  retained the Node-only permission, dry-run, verbose, and rate-limit guards

## 2026-07-22 — Initial v0.13.2 Conversion

- pinned npm package `backlog-mcp-server@0.13.2`
- checked upstream commit
  `d12f010de976af11bcd43f1d3497dc7043d26e62`
- mapped 58 normal tools
- preserved upstream `addDocument` camelCase operation name
- preserved upstream `count_notifications` operation name
- removed MCP transport and dynamic-toolset operations from the target runtime
- recorded field-selection, token-limit, OAuth HTTP, and organization-discovery
  parity as deliberate initial gaps

No upstream source files are edited under `workplace/`.

## 2026-07-22 — Composed MCP Differential Tests

- added automated parity cases for representative READ, CREATE, UPDATE, and
  DELETE operations
- passed identical inputs and mock Backlog responses through the upstream
  composed MCP handler and the Node operation runner
- compared organization selection, transformed API-call arguments, result
  data, and parsed Backlog error messages
- documented MCP content blocks, token truncation, and Node-only safety and
  trace fields as intentional surface differences

## 2026-07-22 — CLI Field Selection Decision

- adopted the upstream GraphQL-style `fields` syntax as a reserved top-level
  input property
- added composed-MCP parity coverage for nested field selection
- moved invalid selection detection before Backlog invocation so malformed
  output controls cannot execute a mutation first
- did not adopt upstream token-count truncation because character-based cuts
  can return partial JSON; callers use `fields` while the CLI preserves a valid
  JSON envelope
