# CLI JSON Parity

## Preserved Contracts

- exact upstream normal tool names
- original Zod input schemas
- original handler calls into `backlog-js`
- original single- and multi-organization API-key environment configuration
- upstream Backlog error parsing
- upstream source and test identity in trace metadata

## v0.18.0 Upstream Delta

- The published package exposes only its root library entry point. The Node
  runtime imports its public `allTools` and `backlogErrorHandler` exports rather
  than unexported `build/` subpaths.
- Dynamic toolsets are removed from the upstream MCP server.
- Upstream field selection is a list-only array on list-returning tools, and
  upstream output metadata identifies field names without output value types.
- `update_issue_comment`, related-Issue operations, optional `parentIssueId`,
  and non-positive Issue-ID fallback remain covered by the converted contract.

The Node policy layer adds the same issue ID/key alternative validation to the
new issue operations. `remove_related_issue` is a DELETE operation and therefore
also requires `--confirm-destructive`.

## CLI Envelope

Successful calls write one JSON object to stdout:

```json
{
  "schemaVersion": 1,
  "operation": "get_issue",
  "toolset": "issue",
  "success": true,
  "result": {},
  "diagnostics": [],
  "trace": {}
}
```

Validation, configuration, confirmation, organization, and upstream failures
use the same envelope with `success: false` and error diagnostics.

## Exit Codes

- `0`: successful metadata command or operation
- `1`: configuration, confirmation, organization, or upstream failure
- `2`: CLI usage or input-schema failure

## Deliberate Differences from MCP

- no MCP content blocks or protocol transport
- no MCP dynamic-toolset calls
- nested GraphQL-style `fields` selection is retained as a Node top-level input
  property; it is no longer an upstream MCP parity feature
- `tools describe <operation>` exposes credential-free input JSON Schema and a
  result-field availability schema; upstream v0.18.0 field names are untyped
- handler-level ID/key and ID/name alternatives are validated before dry-run
  succeeds
- dry-run validates without resolving a Backlog connection
- invalid `fields` is rejected before invoking Backlog, while the upstream MCP
  wrapper parses the selection after its handler returns
- MCP token-count truncation is not exposed because its character cut can
  produce a partial JSON string; callers should use `fields` instead
- CLI trace metadata is added
- CLI calls allow `READ` by default and require `--allow` for `CREATE`,
  `UPDATE`, or `DELETE`
- `BACKLOG_API_ALLOWED_PERMISSIONS` defaults to `READ` and limits the maximum
  call-level CRUD permissions
- destructive and broad-reset operations require
  `--confirm-destructive`
- `--verbose` writes sanitized Backlog access start/outcome JSON events to
  stderr; a whitelist permits resource identifiers, duration, changed field
  names, pagination, actual response status, and validated rate-limit metadata
- related-issue target and relation IDs are included as whitelisted resource
  identifiers when supplied
- content values, full request/response data, organization names, credentials,
personal data, and upstream error text are omitted from verbose events
- `get_project_statuses`, `get_rate_limit`, and `list_organizations` are
  Node-specific READ operations, not upstream normal tools
- `get_project_statuses` applies the Node project ID/key validation before
  resolving a client; it otherwise calls the Backlog status-list endpoint
- `list_organizations` validates local configuration and returns non-secret
  metadata without selecting a client or emitting a Backlog access event

Stdout is reserved for metadata or result JSON except `--help` and `--version`.
Unexpected CLI failures go to stderr.

## Differential Test Boundary

`tests/upstream-differential.test.mjs` runs representative READ, CREATE,
UPDATE, and DELETE operations through both the upstream composed MCP handler
and the Node operation runner. It compares the recovered result data, selected
organization, mock Backlog API call arguments, and parsed Backlog error
messages.

The comparison intentionally normalizes away MCP content blocks and the Node
JSON envelope. A dedicated test records the intentional field-selection
difference: the Node CLI retains nested GraphQL-style selection while upstream
v0.18.0 exposes list-only field arrays. MCP token truncation remains excluded.
Node CRUD permissions, dry-run, verbose access events, destructive
confirmation, diagnostics, and trace metadata are Node-only behavior and are
tested separately.
