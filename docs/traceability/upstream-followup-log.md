# Upstream Follow-Up Log

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
