# Upstream Snapshot

- repository: <https://github.com/nulab/backlog-mcp-server>
- tag: `v0.14.0`
- commit: `9da42fcfb5b69f1455e3864c49f2b57a45a4cbe9`
- npm package: `backlog-mcp-server@0.14.0`
- checked: 2026-07-31
- local checkout: `workplace/upstream/backlog-mcp-server`
- license: MIT

The checkout is disposable and excluded from Git. The npm dependency is pinned
in `package.json` and `package-lock.json`. Runtime builds consume the published
`build/` handlers, not files from `workplace/`.

To update the compatibility baseline, update the checkout, inspect upstream
changes, update the pinned package, regenerate the tool mapping, run tests, and
record accepted differences in `upstream-followup-log.md`.
