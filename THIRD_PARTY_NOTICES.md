# Third-Party Notices

## Nulab Backlog MCP Server

This repository's generated Node runtime directly bundles published handler
code from `backlog-mcp-server` version `0.13.2`.

- Project: <https://github.com/nulab/backlog-mcp-server>
- Copyright: Copyright (c) 2025 Nulab Inc.
- License: MIT
- License text: [`licenses/backlog-mcp-server-MIT.txt`](licenses/backlog-mcp-server-MIT.txt)

The generated runtime removes the MCP transport boundary and invokes the
published tool handlers through this repository's Node CLI adapter. Nulab owns
the upstream Backlog behavior; this repository owns the CLI envelope, basic
safety checks, and Node traceability records.
