#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

for (const args of [["--version"], ["--help"], ["tools", "list"]]) {
  execFileSync("node", ["bundle/backlog-api.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });
}

const runtime = await import("../bundle/backlog-api-runtime.mjs");
assert.equal(runtime.product.name, "backlog-api");
assert.equal(runtime.product.version, "0.3.3");
assert.equal(runtime.listOperations().length, 58);

process.stdout.write("[smoke:node] CLI metadata and importable runtime passed\n");
