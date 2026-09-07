# miku-backlog-api

`miku-backlog-api` is a Node Core/CLI straight conversion of the published
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
[`miku-backlog-api-skills`](https://github.com/igapyon/miku-backlog-api-skills)
repository.

## Node CLI

`miku-backlog-api` is the canonical command and bundle name. The package also
provides `backlog-api` as a compatibility command alias throughout the `0.7.x`
release line; new scripts and documentation use the canonical name.

```bash
node bundle/miku-backlog-api.mjs --version
node bundle/miku-backlog-api.mjs tools list
node bundle/miku-backlog-api.mjs tools describe get_issue
node bundle/miku-backlog-api.mjs trace get_issue
node bundle/miku-backlog-api.mjs call get_issue --input request.json
node bundle/miku-backlog-api.mjs download download_issue_attachment --input request.json --output issue.bin
```

The CLI supports all 62 normal tools registered by the checked upstream
`v0.18.0` source plus eight Node-specific operations: `get_project_statuses`,
`get_rate_limit`, `list_organizations`, `get_issue_participants`,
`get_shared_files`, and the three binary download operations. `call` reads one
JSON object and writes one
structured JSON envelope containing the result, diagnostics, and upstream
trace information.

`tools describe <operation>` is the agent-oriented discovery command. It
returns the operation input as JSON Schema, an `outputFields` inventory for
upstream result fields, important output fields, mutation and
permission metadata, confirmation requirements, and curated examples when
available. `call <operation> --help` is an alias for the same credential-free
JSON output.

### Issue updates and relations

The v0.18.0 compatibility baseline includes `update_issue_comment`,
`get_related_issues`, `add_related_issue`, and `remove_related_issue`.
`update_issue` also accepts an optional `parentIssueId`. Use `tools describe`
for the exact input schema before calling an operation.

`get_related_issues` is a READ operation. `add_related_issue` requires CREATE,
`update_issue_comment` requires UPDATE, and `remove_related_issue` requires
DELETE plus `--confirm-destructive`. Every operation accepts either a positive
`issueId` or an `issueKey` for its source issue; when both are present, a
non-positive `issueId` falls back to `issueKey`.

### Issue participants

The Node-specific `get_issue_participants` READ operation returns the users
participating in one issue. Supply a positive `issueId` or an `issueKey`; a
non-positive ID falls back to the key under the same rule as other issue
operations. The response is a normal JSON list of Backlog user records, and
the usual `fields` selection can reduce it to the values needed by an archive.

```bash
printf '{"issueKey":"PROJ-1","fields":"{ id userId name }"}\n' | \
  node bundle/miku-backlog-api.mjs call get_issue_participants
```

The normal organization, dry-run, permission, trace, and verbose rules apply.
Verbose events expose the issue identifier and access status only; they do not
include participant records.

Delete operations and broad notification reset require
`--confirm-destructive`. Use `--dry-run` to validate input without calling
Backlog or resolving a configured connection. Write permissions and destructive
confirmation continue to apply during dry-run.

For an agent workflow:

1. Run `tools list` to choose an operation and inspect its safety class.
2. Run `tools describe <operation>` to obtain the input contract.
3. Run `call <operation> --dry-run` with the intended JSON.
4. Run the call without `--dry-run` only after validation succeeds.

Use `--verbose` to write a short event for the start and outcome of each
Backlog API access to stderr. Events identify the operation, Backlog client
method, CRUD category, and whether the default or a named organization was
selected. A strict whitelist also exposes resource identifiers such as
`spaceKey`, `projectId`, and `issueKey`, IDs returned by successful API
operations, related-issue IDs, duration, changed field names without values, pagination, and an
HTTP failure status when the upstream error exposes one.

Each line starts with `verbose: ` followed by a JSON object. Request and
response bodies, summaries, descriptions, comments, search terms, organization
names, credentials, personal data, and upstream error text are never included.
Stdout remains machine-readable JSON.

```text
verbose: {"type":"miku-backlog-api-access","phase":"success","access":1,"operation":"get_issue","method":"getIssue","permission":"READ","organization":"default","target":{"issueKey":"PROJ-1"},"result":{"issueId":123,"issueKey":"PROJ-1"},"durationMs":184.2}
```

`call` permits `READ` operations by default. Enable other client-side CRUD
categories explicitly with `--allow CREATE`, `--allow UPDATE`, or
`--allow DELETE`. Delete operations require both `--allow DELETE` and
`--confirm-destructive`; these are independent safeguards.

`BACKLOG_API_ALLOWED_PERMISSIONS` sets the environment-level maximum CRUD
permissions. It is a comma-separated list containing `READ`, `CREATE`,
`UPDATE`, and/or `DELETE`. When it is unset, it defaults to `READ`. Whitespace
around commas and values is ignored, values are case-insensitive, and duplicate
values are normalized. Empty elements and unknown values are configuration
errors. When the variable is defined, `READ` is not added implicitly.

The environment setting and the call-level `--allow` are both required for a
write. `--allow` cannot enable a permission omitted from the environment
setting. This is a client-side safety boundary; it does not change Backlog
account permissions or create a read-only API key.

```bash
# No environment setting is needed for read-only use.
node bundle/miku-backlog-api.mjs call get_issue --input request.json

# CREATE must be allowed by both the environment and this call.
BACKLOG_API_ALLOWED_PERMISSIONS=READ,CREATE \
  node bundle/miku-backlog-api.mjs call add_issue --input request.json --allow CREATE

# DELETE additionally requires destructive-operation confirmation.
BACKLOG_API_ALLOWED_PERMISSIONS=READ,CREATE,UPDATE,DELETE \
  node bundle/miku-backlog-api.mjs call delete_issue --input request.json \
  --allow DELETE --confirm-destructive
```

The Node API applies the same rules. Omitting `RunOperationOptions.env` uses
`process.env`; omitting `allowedPermissions` permits only `READ` for that call.

### Project statuses

The Node-specific `get_project_statuses` READ operation returns the status
list for one project. Supply either `projectId` or `projectKey`; a non-positive
`projectId` falls back to `projectKey`, consistently with the upstream
project-resolution contract.

```bash
printf '{"projectKey":"PROJ"}\n' | \
  node bundle/miku-backlog-api.mjs call get_project_statuses
```

Each returned record contains `id`, `projectId`, `name`, `color`, and
`displayOrder`. For an agent that needs the non-Closed Issues efficiently,
resolve the terminal Closed status as the unique greatest `displayOrder`, then
pass every other returned status ID to `get_issues.statusId`. Do not infer that
status from a localized name, color, or fixed ID. This is distinct from the
project's `useResolvedForChart` setting, which controls chart treatment rather
than the terminal Closed column.

### Archive files and attachments

Use `get_shared_files` to list a project shared-file directory. It accepts a
project ID or key, a directory `path`, and optional `order`, `offset`, and
`count` values. Returned entries preserve Backlog's `type` (`file` or `dir`),
`id`, `name`, `dir`, and `size` metadata and use the ordinary JSON `call`
contract.

```bash
printf '{"projectKey":"PROJ","path":"/archive/","count":100}\n' | \
  node bundle/miku-backlog-api.mjs call get_shared_files
```

`download_issue_attachment`, `download_wiki_attachment`, and
`download_shared_file` open Backlog binary responses as streams. They are READ
operations and support the usual organization choice, permission policy,
dry-run validation, and sanitized verbose events. Use `download`, not `call`:

```bash
printf '{"issueKey":"PROJ-1","attachmentId":12345}\n' | \
  node bundle/miku-backlog-api.mjs download download_issue_attachment --output issue-attachment.bin
printf '{"wikiId":123,"attachmentId":456}\n' | \
  node bundle/miku-backlog-api.mjs download download_wiki_attachment --output wiki-attachment.bin
printf '{"projectKey":"PROJ","sharedFileId":789}\n' | \
  node bundle/miku-backlog-api.mjs download download_shared_file --output shared-file.bin
```

With a file output, the CLI writes to a temporary sibling `.part` file, then
atomically creates the destination only after the stream finishes. It refuses
to overwrite an existing path and prints a JSON transfer summary to stdout.
`--output -` writes only the binary bytes to stdout; diagnostics and `--verbose`
events remain on stderr.
`--dry-run` makes no Backlog request and writes no file. Binary operations
called through `call` fail with `BINARY_OUTPUT_REQUIRED` so JSON and file bytes
cannot be mixed.

The Node API exports `openDownload(operation, input, options)`. Its successful
result supplies `transfer.body` as a `ReadableStream` and
`transfer.completed`, which resolves only after every byte has been read and
rejects on transfer failure or cancellation. Consume the stream without
buffering it when handling large archive files.

### Organization discovery

The Node-specific `list_organizations` READ operation inspects validated local
connection configuration without calling the Backlog API. It returns only
`name`, `domain`, and `isDefault`, never API keys or source environment-variable
names. Single-organization configuration returns `default`; multi-organization
output is sorted by name. It accepts `{}` and optional `fields`, but rejects
`organization` because it lists every configured organization.

```bash
printf '{}\n' | node bundle/miku-backlog-api.mjs call list_organizations
```

`--dry-run` validates this empty input without resolving configuration. A real
call validates configuration but emits no `--verbose` Backlog-access event,
because no Backlog API access occurs.

### Rate limits

The Node-specific `get_rate_limit` READ operation calls Backlog
`GET /api/v2/rateLimit` and returns the `read`, `update`, `search`, and `icon`
limits. The call itself consumes one API request. In a multi-organization
configuration, select the connection with the normal top-level
`organization` input property.

```bash
printf '{}\n' | node bundle/miku-backlog-api.mjs call get_rate_limit
```

When `--verbose` is enabled, successful and failed API outcome events include
the actual HTTP status and any valid `X-RateLimit-Limit`,
`X-RateLimit-Remaining`, and `X-RateLimit-Reset` values captured from that
response. Reset time is exposed as UTC ISO 8601 under `rateLimit.resetAt`.
Missing or invalid header values are omitted. Request URLs, API keys, bodies,
error bodies, and all other headers remain excluded.

Add a top-level `fields` property to the input JSON to select result fields
with the Node CLI's GraphQL-style syntax:

```json
{"issueKey":"PROJ-1","fields":"{ id issueKey summary createdUser { name } }"}
```

The CLI validates `fields` before invoking Backlog and always preserves its
JSON result envelope. Upstream v0.18.0 uses a list-only field array, so this
Node-specific nested selection remains a documented compatibility layer.
`tools describe` exposes upstream field names as `outputFields`; it does not
synthesize an `outputFieldSchema` because v0.18.0 no longer provides recursive
output value schemas. Upstream token-count truncation is not exposed because
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

- `bundle/miku-backlog-api.mjs`
- `bundle/miku-backlog-api-runtime.mjs`
- `bundle/miku-backlog-api-sources.tgz`

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

The sister Skill repository pins a released `miku-backlog-api` runtime and records
the Node version and artifact identity separately.

## License

This project is MIT licensed. The bundled upstream handler code is also MIT
licensed; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
