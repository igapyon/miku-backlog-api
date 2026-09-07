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
assert.equal(runtime.product.version, "0.7.10");
assert.equal(typeof runtime.openDownload, "function");
assert.equal(runtime.listOperations().length, 70);
assert.equal(
  runtime.listOperations().find((operation) => operation.name === "get_rate_limit")
    ?.requiredPermission,
  "READ"
);
assert.equal(
  runtime.listOperations().find((operation) => operation.name === "get_issue_participants")
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
for (const operationName of [
  "get_shared_files",
  "download_issue_attachment",
  "download_wiki_attachment",
  "download_shared_file"
]) {
  assert.equal(
    runtime.listOperations().find((operation) => operation.name === operationName)
      ?.requiredPermission,
    "READ"
  );
}

process.stdout.write("[smoke:node] CLI metadata and importable runtime passed\n");
