# Upstream Test Mapping

The generated tool mapping records the corresponding upstream `*.test.ts` for
each converted operation when present.

Target test layers:

- `tests/node-runtime.test.mjs`
  - operation inventory parity
  - upstream `outputFields` and Node-specific `outputFieldSchema` contracts
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
  - upstream v0.18.0 field-selection difference and retained Node contract
- `tests/node-cli.test.mjs`
  - metadata commands and upstream output-field inventory
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
- `tests/download-operations.test.mjs`
  - shared-file directory listing, ID/key selection, paging, fields, and
    sanitized verbose metadata
  - streamed issue, Wiki, and shared-file downloads, including named
    organization selection and response rate-limit metadata
  - whole-transfer failure reporting, dry-run no-I/O behavior, and atomic
    no-overwrite binary file output
- `tests/issue-participants.test.mjs`
  - participant lookup through issue ID/key resolution and named-organization
    selection
  - fields selection, dry-run input validation, and sanitized verbose success
    and upstream-failure events

The differential suite unwraps the upstream MCP text content and compares its
data with the Node JSON envelope. It separately verifies the intentional
field-selection difference. MCP content blocks, token truncation, and Node-only
permission, dry-run, confirmation, diagnostics, and trace fields remain
intentional surface differences.
