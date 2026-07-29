# Development

## Initial Design Record

- checked date: 2026-07-22
- repository version: `0.5.0`
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
- compatibility version: `v0.13.2`
- checked commit: `d12f010de976af11bcd43f1d3497dc7043d26e62`
- npm package: `backlog-mcp-server@0.13.2`
- upstream license: MIT
- disposable checkout: `workplace/upstream/backlog-mcp-server`

The runtime imports the published handler modules, validates their original
Zod schemas, and invokes their handlers directly. MCP stdio/HTTP transport,
resources, prompts, OAuth HTTP middleware, and dynamic toolset registration are
not part of this Node CLI runtime.

## Repository Boundary

This repository owns:

- TypeScript Node Core/CLI source and operation catalog
- direct upstream handler invocation
- JSON envelopes and CLI exit behavior
- dry-run and destructive-operation guards
- environment-level CRUD permission allow-list
- response-scoped rate-limit metadata and the Node-specific `get_rate_limit`
  operation
- upstream source, test, and operation traceability
- Node build, tests, runtime artifacts, and releases

The sister `backlog-api-skills` repository owns Agent Skill activation,
user-facing authorization policy, working context, workflow guidance, and
cross-product integrations.

## Adopted Decisions

- preserve every upstream normal tool name as one Node operation
- expose `get_rate_limit` as a clearly identified Node-specific operation
- use one generic, tested operation runner instead of duplicating 58 handlers
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
