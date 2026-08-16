# Upstream Source Mapping

The generated authoritative mapping is
[`upstream-tool-mapping.json`](upstream-tool-mapping.json).

Each upstream normal tool is represented as one mapping row with
`origin: "upstream"`:

```text
upstream src/tools/<tool>.ts
  -> published backlog-mcp-server public allTools catalog
  -> src/core/run-operation.ts operation selected by original tool name
  -> bundle/miku-backlog-api.mjs call <operation>
```

The conversion is data-driven. It deliberately does not create 58 near-empty
wrapper files. File-level traceability remains available through the mapping's
`upstreamSource`, `upstreamTest`, and `targetEntry` fields and through the CLI
result `trace` object.

The Node-specific `get_project_statuses`, `get_rate_limit`, and
`list_organizations` operations are represented separately with
`origin: "miku-backlog-api"`, no upstream source/test, and direct target
source/test paths. The first two call supported Backlog client methods; the
last reads only validated local configuration.

Run `npm run trace:refresh` only with the intended upstream checkout at the
recorded version. Tests fail when the runtime operation inventory and committed
mapping differ.

The sister `backlog-api-skills` repository separately records which released
Node runtime it bundles.
