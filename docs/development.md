# Development

## Initial Design Record

- checked date: 2026-07-22
- repository version: `0.7.7`
- implementation maturity: beta standalone Node Core/CLI
- split source: `backlog-api-skills` initial combined implementation

## miku-soft Maintenance Reference

- checked date: 2026-07-22
- skill: `igapyon-miku-soft-developer`
- reference branch: `igapyon-agent-skills` `devel`
- remote reference commit: `ffb31ce3740919ea9e0905a72d89308299f5c021`
- workflow: maintenance mode with the Node App workflow
- architecture reference: `miku-soft-10-mainapp-design.md`

## Upstream Anchor

- repository: <https://github.com/nulab/backlog-mcp-server>
- compatibility version: `v0.18.0`
- checked commit: `1ca465a97d4ec09b96c7b4bece5135004454d2b8`
- npm package: `backlog-mcp-server@0.18.0`
- upstream license: MIT
- disposable checkout: `workplace/upstream/backlog-mcp-server`

The runtime imports the published root library API, validates the original Zod
schemas, and invokes handlers directly. MCP stdio/HTTP transport, resources,
prompts, OAuth HTTP middleware, and server-side tool registration are not part
of this Node CLI runtime.

## Repository Boundary

This repository owns:

- TypeScript Node Core/CLI source and operation catalog
- direct upstream handler invocation
- JSON envelopes and CLI exit behavior
- dry-run and destructive-operation guards
- environment-level CRUD permission allow-list
- response-scoped rate-limit metadata and the Node-specific
  `get_project_statuses`, `get_rate_limit`, and `list_organizations`
  operations
- upstream source, test, and operation traceability
- Node build, tests, runtime artifacts, and releases

The sister `backlog-api-skills` repository owns Agent Skill activation,
user-facing authorization policy, working context, workflow guidance, and
cross-product integrations.

## Adopted Decisions

- preserve every upstream normal tool name as one Node operation
- expose `get_project_statuses`, `get_rate_limit`, and `list_organizations` as
  clearly identified Node-specific operations
- derive a terminal Closed status only from the greatest `displayOrder`; do not
  use localized status names, colors, or fixed IDs
- keep organization discovery local: validate configuration, return only
  non-secret metadata, and make no Backlog API call
- retain the supported `backlog-mcp-server` published-handler dependency until
  an upstream transport-free boundary exists or a separately reviewed local
  conversion proves differential parity
- consume only the upstream package's public root exports; do not rely on
  unexported `build/` subpaths
- retain the Node CLI's nested GraphQL-style `fields` contract as a local
  compatibility layer because v0.18.0 exposes list-only field arrays
- use one generic, tested operation runner instead of duplicating 62 handlers
- generate and commit an upstream tool mapping
- bundle CLI and importable runtime artifacts separately
- require a CLI-level confirmation flag for destructive and broad-reset calls
- default `BACKLOG_API_ALLOWED_PERMISSIONS` to `READ` and treat it as the
  maximum permission boundary for CLI and Node API calls
- keep API access summaries opt-in with `--verbose` and emit structured JSON on
  stderr
- expose only whitelisted resource identifiers and execution metadata; omit
  content values, full requests/responses, credentials, organization names,
  personal data, and error messages
- keep the upstream checkout under ignored `workplace/upstream/`

## Commands

```bash
npm install
npm run typecheck
npm run trace:refresh
npm test
npm run smoke:node
```

Application source lives under `src/` as TypeScript. `npm run build:ts`
compiles it to `dist/ts/`; esbuild then creates the distributable `.mjs`
bundles. Tests remain Node ESM JavaScript and exercise the compiled source and
bundles.
