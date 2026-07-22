#!/usr/bin/env node

import fs from "node:fs";
import { listOperations } from "./core/catalog.js";
import type {
  BacklogAccessEvent,
  CrudPermission,
  RunOperationOptions
} from "./core/contracts.js";
import { getMapping } from "./core/traceability.js";
import { runOperation } from "./core/run-operation.js";
import { formatBacklogAccessEvent } from "./core/verbose-format.js";
import { product } from "./runtime.js";

const HELP = `backlog-api ${product.version} — JSON CLI for Backlog API operations

Usage:
  backlog-api --version
  backlog-api --help
  backlog-api tools list
  backlog-api trace [operation]
  backlog-api call <operation> [--input <file|->] [--allow <permissions>]
      [--dry-run] [--confirm-destructive] [--verbose]

Commands:
  --version
      Print only the product version, for example: ${product.version}

  --help
      Print this help text. No Backlog credentials are required.

  tools list
      Print a JSON catalog of available operations. Each entry includes the
      operation name, description, toolset, and mutation classification.

  trace [operation]
      Print JSON traceability metadata for all operations or one operation.
      Use this to relate a Node operation to its upstream implementation.

  call <operation>
      Read one JSON object, invoke the named operation, and print one JSON
      result envelope. Use "tools list" to discover operation names.

Call options:
  --input <file>          Read the request object from a UTF-8 JSON file.
  --input -               Read the request object from stdin (default).
  --allow <permissions>   Allow comma-separated CRUD permissions. Defaults to
                          READ. Values: READ, CREATE, UPDATE, DELETE.
  --dry-run               Validate and normalize input without invoking Backlog.
  --confirm-destructive   Explicitly authorize delete_* or broad reset calls.
  --verbose               Write a safe summary of each Backlog API access to
                          stderr. Arguments, credentials, and results are omitted.

Input JSON:
  The input must be exactly one JSON object. Operation arguments are top-level
  properties. In a multi-organization setup, add "organization" to select a
  configured Backlog connection; it is not forwarded to the Backlog API. Add
  "fields" with a GraphQL-style selection such as "{ id summary }" to return
  only selected result fields.

Output:
  "tools list", "trace", and "call" write machine-readable JSON to stdout.
  A call result contains schemaVersion, operation, success, diagnostics,
  trace, and either result or dryRun/input data. --help and --version are the
  only plain-text stdout commands. Unexpected CLI errors are written to stderr.
  --verbose adds "verbose:" access events to stderr without changing stdout.

Safety:
  Calls allow READ operations only by default. CREATE, UPDATE, and DELETE must
  be explicitly enabled with --allow. This is a client-side execution policy,
  not a Backlog account permission.

  delete_* and reset_unread_notification_count require
  --confirm-destructive when applicable, independently of --allow. DELETE
  therefore requires both --allow DELETE and --confirm-destructive.

Environment:
  BACKLOG_DOMAIN and BACKLOG_API_KEY configure one connection. The upstream
  BACKLOG_DEFAULT_ORG and BACKLOG_ORG_<NAME>_* variables configure multiple
  organizations. Metadata commands do not require credentials.

Exit codes:
  0  Successful metadata command or operation.
  1  Configuration, confirmation, organization, or Backlog API failure.
  2  CLI usage, fields-selection, or operation input-schema failure.

Examples:
  backlog-api tools list
  backlog-api trace get_issue
  printf '{"issueKey":"PROJ-1"}\\n' | backlog-api call get_issue
  printf '{"issueKey":"PROJ-1","fields":"{ id summary }"}\\n' | backlog-api call get_issue
  backlog-api call get_issue --input request.json --dry-run
  backlog-api call get_issue --input request.json --verbose
  backlog-api call add_issue --input request.json --allow CREATE
  backlog-api call delete_issue --input request.json --allow DELETE --confirm-destructive
`;

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
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
    let allowedPermissions;
    try {
      allowedPermissions = parseAllowedPermissions(optionValue(args, "--allow"));
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 2;
      return;
    }
    const input = JSON.parse(await readInput(inputPath));
    const options: RunOperationOptions = {
      dryRun: args.includes("--dry-run"),
      confirmDestructive: args.includes("--confirm-destructive"),
      allowedPermissions
    };
    if (args.includes("--verbose")) {
      options.onAccess = writeVerboseEvent;
    }
    const result = await runOperation(args[1], input, options);
    writeJson(result);
    if (!result.success) {
      process.exitCode = result.diagnostics.some((diagnostic) =>
        diagnostic.code === "INVALID_ARGUMENT" || diagnostic.code === "INVALID_FIELDS"
      ) ? 2 : 1;
    }
    return;
  }

  process.stderr.write("Unknown command. Use --help for usage.\n");
  process.exitCode = 2;
}

function optionValue(args: string[], name: string): string | undefined {
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

function parseAllowedPermissions(value: string | undefined): CrudPermission[] {
  if (value === undefined) {
    return ["READ"];
  }
  const supported = new Set<CrudPermission>(["READ", "CREATE", "UPDATE", "DELETE"]);
  const permissions = [...new Set(value.split(",").map((entry) => entry.trim().toUpperCase()))];
  const invalid = permissions.filter(
    (permission) => !supported.has(permission as CrudPermission)
  );
  if (invalid.length > 0) {
    throw new Error(
      `--allow contains unsupported permission(s): ${invalid.join(", ")}. ` +
      "Use READ, CREATE, UPDATE, or DELETE."
    );
  }
  return permissions as CrudPermission[];
}

async function readInput(inputPath: string): Promise<string> {
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

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeVerboseEvent(event: BacklogAccessEvent): void {
  process.stderr.write(`${formatBacklogAccessEvent(event)}\n`);
}
