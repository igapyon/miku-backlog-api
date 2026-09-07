# Downstream Runtime Handoff

## Compatibility Baseline

- upstream package: `backlog-mcp-server@0.18.0`
- upstream tag: `v0.18.0`
- upstream commit: `1ca465a97d4ec09b96c7b4bece5135004454d2b8`
- current package version: `0.7.10`
- normal upstream operations: 62
- Node-specific operations: `get_project_statuses`, `get_rate_limit`,
  `list_organizations`, `get_issue_participants`, `get_shared_files`,
  `download_issue_attachment`, `download_wiki_attachment`, and
  `download_shared_file`

## Runtime Changes for the Sister Agent Skill

- added `get_project_statuses` (READ), with project ID/key resolution and the
  terminal Closed-status rule based solely on greatest `displayOrder`
- added `list_organizations` (READ), which returns non-secret validated local
  configuration metadata without making a Backlog API call
- added `get_related_issues` (READ)
- added `add_related_issue` (CREATE)
- added `update_issue_comment` (UPDATE)
- added `remove_related_issue` (DELETE and destructive confirmation)
- preserved `update_issue.parentIssueId`
- preserved fallback from non-positive `issueId` to `issueKey`
- replaced unexported upstream module imports with the public root library API
- retained nested GraphQL-style Node `fields`; upstream v0.18.0 now exposes
  list-only field arrays and untyped output field names
- expose upstream operation result fields as `outputFields`; do not synthesize
  `outputFieldSchema` compatibility metadata for those operations
- added `get_shared_files` (READ) for project shared-file directory listing,
  with offset/count paging and file-or-folder metadata
- added `get_issue_participants` (READ), using the normal issue ID/key
  resolution and returning participant records through the JSON operation
  contract
- added streamed READ downloads for issue attachments, Wiki attachments, and
  project shared files; Node consumers use `openDownload`, whose `completed`
  promise represents whole-transfer success or failure
- added the `download` CLI command. It keeps binary output separate from JSON,
  writes file destinations atomically without overwrite, and defers successful
  verbose completion until all bytes are consumed

The Node runtime continues to require the environment permission ceiling and
call-level `--allow` for every write. `remove_related_issue` also requires
`--confirm-destructive`.

## Handoff Preconditions

Do not pin an uncommitted local bundle in the downstream repository. After the
source change is committed and a release version or accepted tag suffix is
chosen, rebuild from a clean worktree and provide all of the following:

1. the exact `miku-backlog-api` commit and release tag
2. `bundle/miku-backlog-api.mjs`
3. `bundle/miku-backlog-api-runtime.mjs`
4. `bundle/miku-backlog-api-sources.tgz`
5. SHA-256 values calculated from those clean-build artifacts
6. the v0.18.0 compatibility and safety delta above

Run `npm run typecheck`, `npm run trace:refresh`, `npm test`, and
`npm run smoke:node` before recording the runtime identity in
the sister Agent Skill repository.
