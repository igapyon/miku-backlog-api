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
- `tests/access-policy-and-rate-limit.test.mjs`
  - environment CRUD permission parsing and enforcement
  - Node-specific `get_project_statuses`, `get_rate_limit`, and
    `list_organizations`
  - local-operation input, fields, trace, organization, and no-secret guards
  - rate-limit response-header validation
  - parallel access-context isolation
  - representative CRUD response metadata
- `scripts/smoke-node.mjs`
  - generated CLI metadata commands and importable runtime startup

The differential suite unwraps the upstream MCP text content and compares its
data with the Node JSON envelope. Field selection is compared explicitly. MCP
content blocks, token truncation, and Node-only permission, dry-run,
confirmation, diagnostics, and trace fields remain intentional surface
differences.
