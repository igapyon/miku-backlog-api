# Remaining Migration Items

## Completed

- pinned upstream source and published package
- direct invocation of all registered normal handlers
- generated operation/source/test mapping
- single-file CLI and importable runtime bundles
- schema validation, JSON envelope, diagnostics, and trace metadata
- destructive-operation guard
- standalone Node CLI and importable runtime smoke

## Pending Evaluation

- token-limit parity
- broader differential output tests against MCP-composed handlers
- optional MCP fallback policy; not enabled in the Node CLI

These items are not implicit promises. Promote them into scope only through an
intentional compatibility update.
