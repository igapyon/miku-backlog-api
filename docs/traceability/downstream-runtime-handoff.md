# Downstream Runtime Handoff

## Compatibility Baseline

- upstream package: `backlog-mcp-server@0.14.0`
- upstream tag: `v0.14.0`
- upstream commit: `9da42fcfb5b69f1455e3864c49f2b57a45a4cbe9`
- current package version: `0.7.0`
- normal upstream operations: 62
- Node-specific operations: `get_rate_limit`

## Runtime Changes for the Sister Agent Skill

- added `get_related_issues` (READ)
- added `add_related_issue` (CREATE)
- added `update_issue_comment` (UPDATE)
- added `remove_related_issue` (DELETE and destructive confirmation)
- preserved `update_issue.parentIssueId`
- preserved fallback from non-positive `issueId` to `issueKey`

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
6. the v0.14.0 compatibility and safety delta above

Run `npm run typecheck`, `npm run trace:refresh`, `npm test`, and
`npm run smoke:node` before recording the runtime identity in
the sister Agent Skill repository.
