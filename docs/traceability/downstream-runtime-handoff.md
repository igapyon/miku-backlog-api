# Downstream Runtime Handoff

## Compatibility Baseline

- upstream package: `backlog-mcp-server@0.18.0`
- upstream tag: `v0.18.0`
- upstream commit: `1ca465a97d4ec09b96c7b4bece5135004454d2b8`
- current package version: `0.7.7`
- normal upstream operations: 62
- Node-specific operations: `get_project_statuses`, `get_rate_limit`, and
  `list_organizations`

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
