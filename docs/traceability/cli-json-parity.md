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
- no GraphQL-style field selection in the initial CLI
- no MCP token-count truncation in the initial CLI
- CLI trace metadata is added
- CLI calls allow `READ` by default and require `--allow` for `CREATE`,
  `UPDATE`, or `DELETE`
- destructive and broad-reset operations require
  `--confirm-destructive`

Stdout is reserved for metadata or result JSON except `--help` and `--version`.
Unexpected CLI failures go to stderr.
