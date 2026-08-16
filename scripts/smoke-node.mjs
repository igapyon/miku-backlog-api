#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

for (const args of [["--version"], ["--help"], ["tools", "list"]]) {
  execFileSync("node", ["bundle/miku-backlog-api.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });
}

const runtime = await import("../bundle/miku-backlog-api-runtime.mjs");
assert.equal(runtime.product.name, "miku-backlog-api");
assert.equal(runtime.product.version, "0.7.1");
assert.equal(runtime.listOperations().length, 65);
assert.equal(
  runtime.listOperations().find((operation) => operation.name === "get_rate_limit")
    ?.requiredPermission,
  "READ"
);
assert.equal(
  runtime.listOperations().find((operation) => operation.name === "get_project_statuses")
    ?.requiredPermission,
  "READ"
);
assert.equal(
  runtime.listOperations().find((operation) => operation.name === "list_organizations")
    ?.requiredPermission,
  "READ"
);

process.stdout.write("[smoke:node] CLI metadata and importable runtime passed\n");
