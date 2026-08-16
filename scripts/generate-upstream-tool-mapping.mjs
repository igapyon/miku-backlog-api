#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listOperations } from "../dist/ts/core/catalog.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const upstreamRoot = path.resolve(root, "workplace", "upstream", "backlog-mcp-server");
const upstreamToolsRoot = path.resolve(upstreamRoot, "src", "tools");
const outputPath = path.resolve(root, "docs", "traceability", "upstream-tool-mapping.json");
const productVersion = JSON.parse(
  fs.readFileSync(path.resolve(root, "package.json"), "utf8")
).version;

const LOCAL_OPERATION_MAPPINGS = new Map([
  ["list_organizations", {
    targetEntry: "src/core/local-tools.ts",
    targetTest: "tests/access-policy-and-rate-limit.test.mjs"
  }],
  ["get_project_statuses", {
    targetEntry: "src/core/local-tools.ts",
    targetTest: "tests/access-policy-and-rate-limit.test.mjs"
  }],
  ["get_rate_limit", {
    targetEntry: "src/core/local-tools.ts",
    targetTest: "tests/access-policy-and-rate-limit.test.mjs"
  }]
]);

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
  const localMapping = LOCAL_OPERATION_MAPPINGS.get(operation.name);
  if (localMapping !== undefined) {
    return {
      operation: operation.name,
      toolset: operation.toolset,
      mutationClass: operation.mutationClass,
      origin: "miku-backlog-api",
      upstreamSource: null,
      upstreamTest: null,
      ...localMapping
    };
  }
  const upstreamSource = sourceByOperation.get(operation.name);
  if (!upstreamSource) {
    throw new Error(`no upstream or local source mapping for operation: ${operation.name}`);
  }
  const upstreamTest = upstreamSource.replace(/\.ts$/, ".test.ts");
  return {
    operation: operation.name,
    toolset: operation.toolset,
    mutationClass: operation.mutationClass,
    origin: "upstream",
    upstreamSource,
    upstreamTest: fs.existsSync(path.resolve(upstreamRoot, upstreamTest))
      ? upstreamTest
      : null,
    targetEntry: "src/core/run-operation.ts",
    targetTest: "tests/upstream-differential.test.mjs"
  };
});

const mapping = {
  schemaVersion: 1,
  upstream: {
    repository: "https://github.com/nulab/backlog-mcp-server",
    version: "0.18.0",
    tag: "v0.18.0",
    commit: "1ca465a97d4ec09b96c7b4bece5135004454d2b8",
    checked: "2026-08-16"
  },
  target: {
    repository: "miku-backlog-api",
    product: "miku-backlog-api",
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
