# Upstream Snapshot

- repository: <https://github.com/nulab/backlog-mcp-server>
- tag: `v0.20.4`
- commit: `7d977af9d00639d17fe2f4f21c03aa9f1ab2fe07`
- npm package: `backlog-mcp-server@0.20.4`
- checked: 2026-10-01
- local checkout: `workplace/upstream/backlog-mcp-server`
- license: MIT

The checkout is disposable and excluded from Git. The npm dependency is pinned
in `package.json` and `package-lock.json`. Runtime builds consume the published
`build/` handlers, not files from `workplace/`.

To update the compatibility baseline, update the checkout, inspect upstream
changes, update the pinned package, regenerate the tool mapping, run tests, and
record accepted differences in `upstream-followup-log.md`.
