# Upstream Snapshot

- repository: <https://github.com/nulab/backlog-mcp-server>
- tag: `v0.13.2`
- commit: `d12f010de976af11bcd43f1d3497dc7043d26e62`
- npm package: `backlog-mcp-server@0.13.2`
- checked: 2026-07-22
- local checkout: `workplace/upstream/backlog-mcp-server`
- license: MIT

The checkout is disposable and excluded from Git. The npm dependency is pinned
in `package.json` and `package-lock.json`. Runtime builds consume the published
`build/` handlers, not files from `workplace/`.

To update the compatibility baseline, update the checkout, inspect upstream
changes, update the pinned package, regenerate the tool mapping, run tests, and
record accepted differences in `upstream-followup-log.md`.
