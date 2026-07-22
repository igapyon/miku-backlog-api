#!/usr/bin/env node

import fs from "node:fs";
import { listOperations } from "./core/catalog.mjs";
import { getMapping } from "./core/traceability.mjs";
import { runOperation } from "./core/run-operation.mjs";
import { product } from "./runtime.mjs";

const HELP = `backlog-api ${product.version}

Usage:
  backlog-api --version
  backlog-api --help
  backlog-api tools list
  backlog-api trace [operation]
  backlog-api call <operation> [--input <file|->] [--dry-run] [--confirm-destructive]

Input:
  --input <file>   Read one JSON object from a UTF-8 file.
  --input -        Read one JSON object from stdin. This is the default for call.

Safety:
  delete_* and broad notification reset operations require
  --confirm-destructive in addition to a valid request.

Environment:
  BACKLOG_DOMAIN and BACKLOG_API_KEY, or the upstream multi-organization
  BACKLOG_DEFAULT_ORG and BACKLOG_ORG_<NAME>_* variables.
`;

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args[0] === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (args.includes("--version")) {
    process.stdout.write(`${product.version}\n`);
    return;
  }
  if (args[0] === "tools" && args[1] === "list") {
    writeJson({ schemaVersion: 1, product, operations: listOperations() });
    return;
  }
  if (args[0] === "trace") {
    const mapping = getMapping();
    const operation = args[1];
    writeJson(
      operation
        ? {
            ...mapping.upstream,
            operation: mapping.operations.find((entry) => entry.operation === operation)
          }
        : mapping
    );
    return;
  }
  if (args[0] === "call" && args[1]) {
    const inputPath = optionValue(args, "--input") ?? "-";
    const input = JSON.parse(await readInput(inputPath));
    const result = await runOperation(args[1], input, {
      dryRun: args.includes("--dry-run"),
      confirmDestructive: args.includes("--confirm-destructive")
    });
    writeJson(result);
    if (!result.success) {
      process.exitCode = result.diagnostics.some(
        (diagnostic) => diagnostic.code === "INVALID_ARGUMENT"
      ) ? 2 : 1;
    }
    return;
  }

  process.stderr.write("Unknown command. Use --help for usage.\n");
  process.exitCode = 2;
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

async function readInput(inputPath) {
  if (inputPath !== "-") {
    return fs.readFileSync(inputPath, "utf8");
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim().length === 0) {
    throw new Error("call requires one JSON object through --input or stdin.");
  }
  return text;
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
