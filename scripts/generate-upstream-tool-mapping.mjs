#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listOperations } from "../src/core/catalog.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const upstreamRoot = path.resolve(root, "workplace", "upstream", "backlog-mcp-server");
const upstreamToolsRoot = path.resolve(upstreamRoot, "src", "tools");
const outputPath = path.resolve(root, "docs", "traceability", "upstream-tool-mapping.json");
const productVersion = JSON.parse(
  fs.readFileSync(path.resolve(root, "package.json"), "utf8")
).version;

if (!fs.existsSync(upstreamToolsRoot)) {
  throw new Error(`missing upstream checkout: ${upstreamToolsRoot}`);
}

const sourceByOperation = new Map();
for (const filename of fs.readdirSync(upstreamToolsRoot).sort(compareUtf16)) {
  if (!filename.endsWith(".ts") || filename.endsWith(".test.ts") || filename === "tools.ts") {
    continue;
  }
  const sourcePath = path.resolve(upstreamToolsRoot, filename);
  const source = fs.readFileSync(sourcePath, "utf8");
  const match = /\bname:\s*['"]([^'"]+)['"]/.exec(source);
  if (match) {
    sourceByOperation.set(match[1], `src/tools/${filename}`);
  }
}

const operations = listOperations().map((operation) => {
  const upstreamSource = sourceByOperation.get(operation.name);
  if (!upstreamSource) {
    throw new Error(`no upstream source mapping for operation: ${operation.name}`);
  }
  const upstreamTest = upstreamSource.replace(/\.ts$/, ".test.ts");
  return {
    operation: operation.name,
    toolset: operation.toolset,
    mutationClass: operation.mutationClass,
    upstreamSource,
    upstreamTest: fs.existsSync(path.resolve(upstreamRoot, upstreamTest))
      ? upstreamTest
      : null,
    targetEntry: "src/core/run-operation.mjs"
  };
});

const mapping = {
  schemaVersion: 1,
  upstream: {
    repository: "https://github.com/nulab/backlog-mcp-server",
    version: "0.13.2",
    tag: "v0.13.2",
    commit: "d12f010de976af11bcd43f1d3497dc7043d26e62",
    checked: "2026-07-22"
  },
  target: {
    repository: "backlog-api",
    product: "backlog-api",
    version: productVersion,
    strategy: "published-handler-direct-invocation"
  },
  operations
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(mapping, null, 2)}\n`);
process.stdout.write(`generated: ${path.relative(root, outputPath)} (${operations.length} operations)\n`);

function compareUtf16(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
