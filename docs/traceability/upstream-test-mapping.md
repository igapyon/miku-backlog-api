# Upstream Test Mapping

The generated tool mapping records the corresponding upstream `*.test.ts` for
each converted operation when present.

Target test layers:

- `tests/node-runtime.test.mjs`
  - operation inventory parity
  - source and upstream-test mapping completeness
  - input schema validation
  - direct handler invocation with a mocked Backlog client
  - destructive-operation guard
- `tests/upstream-differential.test.mjs`
  - representative READ, CREATE, UPDATE, and DELETE operations
  - identical input and mock Backlog responses for the upstream composed MCP
    handler and the Node operation runner
  - API-call argument, result-data, organization-selection, and Backlog-error
    message parity
  - GraphQL-style field-selection parity
- `tests/node-cli.test.mjs`
  - metadata commands
  - JSON stdout and exit-code behavior
- `scripts/smoke-node.mjs`
  - generated CLI metadata commands and importable runtime startup

The differential suite unwraps the upstream MCP text content and compares its
data with the Node JSON envelope. Field selection is compared explicitly. MCP
content blocks, token truncation, and Node-only permission, dry-run,
confirmation, diagnostics, and trace fields remain intentional surface
differences.
