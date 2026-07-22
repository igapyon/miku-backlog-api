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
- `tests/node-cli.test.mjs`
  - metadata commands
  - JSON stdout and exit-code behavior
- `scripts/smoke-node.mjs`
  - generated CLI metadata commands and importable runtime startup

The first version proves the common adapter and representative read/destructive
paths. Broader differential parity against the upstream composed MCP result
wrapper remains tracked in `TODO.md`.
