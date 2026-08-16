# Upstream Snapshot

- repository: <https://github.com/nulab/backlog-mcp-server>
- tag: `v0.18.0`
- commit: `1ca465a97d4ec09b96c7b4bece5135004454d2b8`
- npm package: `backlog-mcp-server@0.18.0`
- checked: 2026-08-16
- local checkout: `workplace/upstream/backlog-mcp-server`
- license: MIT

The checkout is disposable and excluded from Git. The npm dependency is pinned
in `package.json` and `package-lock.json`. Runtime builds consume the published
`build/` handlers, not files from `workplace/`.

To update the compatibility baseline, update the checkout, inspect upstream
changes, update the pinned package, regenerate the tool mapping, run tests, and
record accepted differences in `upstream-followup-log.md`.
