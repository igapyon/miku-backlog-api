# CLI JSON Parity

## Preserved Contracts

- exact upstream normal tool names
- original Zod input schemas
- original handler calls into `backlog-js`
- original single- and multi-organization API-key environment configuration
- upstream Backlog error parsing
- upstream source and test identity in trace metadata

## v0.14.0 Upstream Delta

- `update_issue_comment` is exposed as an UPDATE operation.
- `get_related_issues`, `add_related_issue`, and `remove_related_issue` are
  exposed as READ, CREATE, and destructive DELETE operations respectively.
- `update_issue` preserves the upstream optional `parentIssueId` input.
- Issue handlers use `issueKey` when both identifiers are supplied and
  `issueId` is non-positive, matching the upstream resolver.

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
- GraphQL-style `fields` selection is accepted as a top-level input property
- `tools describe <operation>` exposes the input and result-field schemas as
  credential-free JSON for agent discovery
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
JSON envelope. GraphQL-style field selection is covered by a dedicated parity
case. MCP token truncation remains excluded. Node CRUD permissions, dry-run,
verbose access events, destructive confirmation, diagnostics, and trace metadata are Node-only
behavior and are tested separately.
