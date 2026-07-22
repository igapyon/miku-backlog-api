# CLI JSON Parity

## Preserved Contracts

- exact upstream normal tool names
- original Zod input schemas
- original handler calls into `backlog-js`
- original single- and multi-organization API-key environment configuration
- upstream Backlog error parsing
- upstream source and test identity in trace metadata

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
- invalid `fields` is rejected before invoking Backlog, while the upstream MCP
  wrapper parses the selection after its handler returns
- MCP token-count truncation is not exposed because its character cut can
  produce a partial JSON string; callers should use `fields` instead
- CLI trace metadata is added
- CLI calls allow `READ` by default and require `--allow` for `CREATE`,
  `UPDATE`, or `DELETE`
- destructive and broad-reset operations require
  `--confirm-destructive`
- `--verbose` writes sanitized Backlog access start/outcome events to stderr;
  request arguments, organization names, credentials, responses, and upstream
  error text are omitted

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
