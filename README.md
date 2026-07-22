# backlog-api

`backlog-api` is a Node Core/CLI straight conversion of the published
[Nulab Backlog MCP Server](https://github.com/nulab/backlog-mcp-server) tool
handlers.

> [!IMPORTANT]
> This project is currently in beta. Interfaces and behavior may change before
> the stable release.

The TypeScript implementation removes the MCP transport boundary while preserving upstream
tool names, Zod input schemas, handler behavior, Backlog API behavior, and
source/test traceability. It adds a JSON CLI envelope, dry-run validation, and
confirmation guards for destructive operations.

Agent workflows, working context, user-facing authorization policy, and
integrations belong to the sister
[`backlog-api-skills`](https://github.com/igapyon/backlog-api-skills)
repository.

## Node CLI

```bash
node bundle/backlog-api.mjs --version
node bundle/backlog-api.mjs tools list
node bundle/backlog-api.mjs trace get_issue
node bundle/backlog-api.mjs call get_issue --input request.json
```

The CLI supports all 58 normal tools registered by the checked upstream
`v0.13.2` source. `call` reads one JSON object and writes one structured JSON
envelope containing the result, diagnostics, and upstream trace information.

Delete operations and broad notification reset require
`--confirm-destructive`. Use `--dry-run` to validate input without calling
Backlog.

Use `--verbose` to write a short event for the start and outcome of each
Backlog API access to stderr. Events identify the operation, Backlog client
method, CRUD category, and whether the default or a named organization was
selected. Request arguments, organization names, credentials, response data,
and upstream error text are never included. Stdout remains machine-readable
JSON.

`call` permits `READ` operations by default. Enable other client-side CRUD
categories explicitly with `--allow CREATE`, `--allow UPDATE`, or
`--allow DELETE`. Delete operations require both `--allow DELETE` and
`--confirm-destructive`; these are independent safeguards.

Add a top-level `fields` property to the input JSON to select result fields
with the upstream GraphQL-style syntax:

```json
{"issueKey":"PROJ-1","fields":"{ id issueKey summary createdUser { name } }"}
```

The CLI validates `fields` before invoking Backlog and always preserves its
JSON result envelope. Upstream token-count truncation is not exposed because
cutting serialized JSON can produce an invalid or ambiguous result; use
`fields` to reduce output instead.

## Requirements and Authentication

- Node.js 22 or later
- a Backlog account with API access
- `BACKLOG_DOMAIN` and `BACKLOG_API_KEY`, or the upstream multi-organization
  environment variables

Credentials are inherited from the execution environment. They are not stored,
printed, or bundled by this repository.

### Local Connection Configuration

When a local Backlog connection file is explicitly requested, create
`workplace/backlog.env` with this template and replace the example domain:

```dotenv
BACKLOG_DOMAIN=userunique.backlog.com
BACKLOG_API_KEY=
```

Apply the following safety rules:

- create the file only after an explicit request
- set its permissions to `600`
- never overwrite an existing file
- never print or copy its values into chat, logs, tracked files, or generated
  artifacts
- specify `BACKLOG_DOMAIN` as a host name only, without `https://` or a trailing
  slash
- confirm that the file remains ignored by Git under `workplace/`
- begin a connection test with a read-only operation such as `get_space`

The CLI does not automatically load this file. A local operator or Agent
workflow must load its values into the process environment immediately before
invoking the CLI.

## Build and Test

Dependency lifecycle scripts are disabled because the pinned upstream package
enforces pnpm even though this project consumes its published `build/`
artifacts directly.

```bash
npm install
npm run typecheck
npm run trace:refresh
npm test
npm run smoke:node
```

Generated outputs include:

- `bundle/backlog-api.mjs`
- `bundle/backlog-api-runtime.mjs`
- `bundle/backlog-api-sources.tgz`

Authoritative application sources are TypeScript files under `src/`. The
compiled `dist/ts/` tree and bundled `.mjs` files are generated artifacts.

## Upstream Traceability

The disposable upstream checkout belongs under
`workplace/upstream/backlog-mcp-server`. Refresh the generated mapping after
intentionally updating that checkout and the pinned package:

```bash
npm run trace:refresh
```

See [`docs/traceability/`](docs/traceability/) for the upstream source, test,
operation, and compatibility records.

Node-specific planned work is tracked in
[GitHub Issues](https://github.com/igapyon/backlog-api/issues).

The sister Skill repository pins a released `backlog-api` runtime and records
the Node version and artifact identity separately.

## License

This project is MIT licensed. The bundled upstream handler code is also MIT
licensed; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
