#!/usr/bin/env node

import fs from "node:fs";
import { describeOperation, listOperations } from "./core/catalog.js";
import {
  CliUsageError,
  parseCliArguments
} from "./core/cli-arguments.js";
import type { BacklogAccessEvent, RunOperationOptions } from "./core/contracts.js";
import { getMapping } from "./core/traceability.js";
import { runOperation } from "./core/run-operation.js";
import { formatBacklogAccessEvent } from "./core/verbose-format.js";
import { product } from "./runtime.js";

const HELP = `backlog-api ${product.version} — JSON CLI for Backlog API operations

Usage:
  backlog-api --version
  backlog-api --help
  backlog-api tools list
  backlog-api tools describe <operation>
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
      operation name, description, toolset, mutation classification, and
      required permission.

  tools describe <operation>
      Print the machine-readable contract for one operation: input JSON Schema,
      result fields available to "fields", safety requirements, and examples.
      No Backlog credentials are required.

  trace [operation]
      Print JSON traceability metadata for all operations or one operation.
      Use this to relate a Node operation to its upstream implementation.

  call <operation>
      Read one JSON object, invoke the named operation, and print one JSON
      result envelope. Use "tools list" to discover operation names and
      "tools describe <operation>" to discover its input contract.
      "call <operation> --help" is an alias for "tools describe <operation>".

Call options:
  --input <file>          Read the request object from a UTF-8 JSON file.
  --input -               Read the request object from stdin (default).
  --allow <permissions>   Allow comma-separated CRUD permissions. Defaults to
                          READ. Values: READ, CREATE, UPDATE, DELETE. This
                          cannot exceed BACKLOG_API_ALLOWED_PERMISSIONS.
  --dry-run               Validate and normalize input without resolving a
                          Backlog connection or requiring credentials. Write
                          permissions and destructive confirmation still apply.
  --confirm-destructive   Explicitly authorize delete_* or broad reset calls.
  --verbose               Write a safe summary of each Backlog API access to
                          stderr as a "verbose: " prefixed JSON object. A
                          whitelist may include resource IDs/keys, duration,
                          changed field names, pagination, and an exposed HTTP
                          failure status. Content values, credentials, personal
                          data, full arguments/results, and error text are omitted.
  Each option may be specified once. Unknown options, duplicate options, and
  extra positional arguments are usage errors.

Input JSON:
  The input must be exactly one JSON object. Operation arguments are top-level
  properties. In a multi-organization setup, add "organization" to select a
  configured Backlog connection; it is not forwarded to the Backlog API. Add
  "fields" with a GraphQL-style selection such as "{ id summary }" to return
  only selected result fields.

Output:
  All commands except --help and --version write machine-readable JSON to stdout.
  A call result contains schemaVersion, operation, success, diagnostics,
  trace, and either result or dryRun/input data. --help and --version are the
  only plain-text stdout commands. Unexpected CLI errors are written to stderr.
  --verbose adds "verbose:" JSON access events to stderr without changing
  stdout. Start and outcome events share the same access number. Safe input
  identifiers appear under target; IDs returned on success appear under result.

Safety:
  Calls allow READ operations only by default. CREATE, UPDATE, and DELETE must
  be enabled both by BACKLOG_API_ALLOWED_PERMISSIONS and --allow. This is a
  client-side execution policy, not a Backlog account permission.

  delete_* and reset_unread_notification_count require
  --confirm-destructive when applicable, independently of --allow. DELETE
  therefore requires both --allow DELETE and --confirm-destructive.

Environment:
  BACKLOG_DOMAIN and BACKLOG_API_KEY configure one connection. The upstream
  BACKLOG_DEFAULT_ORG, BACKLOG_ORG_<NAME>_DOMAIN, and
  BACKLOG_ORG_<NAME>_API_KEY variables configure multiple organizations.
  Metadata commands do not require credentials.

  BACKLOG_API_ALLOWED_PERMISSIONS is a comma-separated environment-level
  maximum using READ, CREATE, UPDATE, and DELETE. It defaults to READ when
  unset. Whitespace around commas and values is ignored. --allow cannot enable
  a permission omitted here. When the variable is set, READ is not added
  implicitly. Values are case-insensitive and duplicates are normalized.
  Empty elements and unknown values are configuration errors detected before
  Backlog credentials or clients are resolved.

  A write requires its permission in both BACKLOG_API_ALLOWED_PERMISSIONS and
  --allow. DELETE additionally requires --confirm-destructive.

  Examples:
    BACKLOG_API_ALLOWED_PERMISSIONS=READ
    BACKLOG_API_ALLOWED_PERMISSIONS=READ,CREATE,UPDATE
    BACKLOG_API_ALLOWED_PERMISSIONS=READ,CREATE,UPDATE,DELETE

Rate limits:
  get_rate_limit is a backlog-api-specific READ operation returning the read,
  update, search, and icon limits. Calling it consumes one API request.
  --verbose outcome events include validated X-RateLimit values and an actual
  HTTP status when the Backlog response exposes them.

Exit codes:
  0  Successful metadata command or operation.
  1  Configuration, confirmation, organization, or Backlog API failure.
  2  CLI usage, fields-selection, or operation input-schema failure.

Agent discovery:
  1. Run "tools list" to choose an operation and inspect its safety class.
  2. Run "tools describe <operation>" to obtain its complete input contract.
  3. Run "call <operation> --dry-run" with the intended JSON.
  4. Only after successful validation, run the call without --dry-run.

Examples:
  backlog-api tools list
  backlog-api tools describe get_issue
  backlog-api call get_issue --help
  backlog-api trace get_issue
  printf '{"issueKey":"PROJ-1"}\\n' | backlog-api call get_issue
  printf '{"issueKey":"PROJ-1","fields":"{ id summary }"}\\n' | backlog-api call get_issue
  backlog-api call get_issue --input request.json --dry-run
  backlog-api call get_issue --input request.json --verbose
  BACKLOG_API_ALLOWED_PERMISSIONS=READ,CREATE backlog-api call add_issue --input request.json --allow CREATE
  BACKLOG_API_ALLOWED_PERMISSIONS=READ,CREATE,UPDATE,DELETE backlog-api call delete_issue --input request.json --allow DELETE --confirm-destructive
  printf '{}\\n' | BACKLOG_API_ALLOWED_PERMISSIONS=READ backlog-api call get_rate_limit
`;

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let command;
  try {
    command = parseCliArguments(args);
  } catch (error) {
    if (!(error instanceof CliUsageError)) {
      throw error;
    }
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
    return;
  }

  if (command.kind === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (command.kind === "version") {
    process.stdout.write(`${product.version}\n`);
    return;
  }
  if (command.kind === "tools-list") {
    writeJson({ schemaVersion: 1, product, operations: listOperations() });
    return;
  }
  if (command.kind === "tools-describe") {
    const operation = describeOperation(command.operation);
    if (operation === undefined) {
      process.stderr.write(
        `Unknown operation: ${command.operation}. Use "tools list" to discover operation names.\n`
      );
      process.exitCode = 2;
      return;
    }
    writeJson({ schemaVersion: 1, product, operation });
    return;
  }
  if (command.kind === "trace") {
    const mapping = getMapping();
    writeJson(
      command.operation
        ? {
            ...mapping.upstream,
            operation: mapping.operations.find(
              (entry) => entry.operation === command.operation
            )
          }
        : mapping
    );
    return;
  }
  if (command.kind === "call") {
    const input = JSON.parse(await readInput(command.inputPath));
    const options: RunOperationOptions = {
      dryRun: command.dryRun,
      confirmDestructive: command.confirmDestructive,
      allowedPermissions: command.allowedPermissions
    };
    if (command.verbose) {
      options.onAccess = writeVerboseEvent;
    }
    const result = await runOperation(command.operation, input, options);
    writeJson(result);
    if (!result.success) {
      process.exitCode = result.diagnostics.some((diagnostic) =>
        diagnostic.code === "INVALID_ARGUMENT" || diagnostic.code === "INVALID_FIELDS"
      ) ? 2 : 1;
    }
    return;
  }
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
