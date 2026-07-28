import {
  CrudPermissionParseError,
  DEFAULT_CRUD_PERMISSIONS,
  parseCrudPermissions
} from "./access-permissions.js";
import type { CrudPermission } from "./contracts.js";

export type CliCommand =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "tools-list" }
  | { kind: "trace"; operation?: string }
  | {
      kind: "call";
      operation: string;
      inputPath: string;
      allowedPermissions: readonly CrudPermission[];
      dryRun: boolean;
      confirmDestructive: boolean;
      verbose: boolean;
    };

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export function parseCliArguments(args: readonly string[]): CliCommand {
  if (args.length === 0 || args.includes("--help")) {
    return { kind: "help" };
  }
  if (args[0] === "help") {
    requireArgumentCount(args, 1, "help");
    return { kind: "help" };
  }
  if (args[0] === "--version") {
    requireArgumentCount(args, 1, "--version");
    return { kind: "version" };
  }
  if (args[0] === "tools" && args[1] === "list") {
    requireArgumentCount(args, 2, "tools list");
    return { kind: "tools-list" };
  }
  if (args[0] === "trace") {
    if (args.length > 2) {
      throw new CliUsageError("trace accepts at most one operation name.");
    }
    const operation = args[1];
    if (operation?.startsWith("--")) {
      throw new CliUsageError(`Unknown option for trace: ${operation}.`);
    }
    return {
      kind: "trace",
      ...(operation === undefined ? {} : { operation })
    };
  }
  if (args[0] === "call") {
    return parseCallArguments(args);
  }
  throw new CliUsageError("Unknown command. Use --help for usage.");
}

function parseCallArguments(args: readonly string[]): CliCommand {
  const operation = args[1];
  if (operation === undefined || operation.startsWith("--")) {
    throw new CliUsageError("call requires an operation name.");
  }

  let inputPath = "-";
  let allowedPermissions: readonly CrudPermission[] = DEFAULT_CRUD_PERMISSIONS;
  let dryRun = false;
  let confirmDestructive = false;
  let verbose = false;
  const seenOptions = new Set<string>();

  for (let index = 2; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!argument.startsWith("--")) {
      throw new CliUsageError(`Unexpected argument for call: ${argument}.`);
    }
    if (seenOptions.has(argument)) {
      throw new CliUsageError(`Option ${argument} may be specified only once.`);
    }
    seenOptions.add(argument);

    if (argument === "--input" || argument === "--allow") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new CliUsageError(`${argument} requires a value.`);
      }
      index += 1;
      if (argument === "--input") {
        inputPath = value;
      } else {
        allowedPermissions = parseAllowedPermissions(value);
      }
      continue;
    }
    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (argument === "--confirm-destructive") {
      confirmDestructive = true;
      continue;
    }
    if (argument === "--verbose") {
      verbose = true;
      continue;
    }
    throw new CliUsageError(`Unknown option for call: ${argument}.`);
  }

  return {
    kind: "call",
    operation,
    inputPath,
    allowedPermissions,
    dryRun,
    confirmDestructive,
    verbose
  };
}

function parseAllowedPermissions(value: string): readonly CrudPermission[] {
  try {
    return parseCrudPermissions(value);
  } catch (error) {
    if (!(error instanceof CrudPermissionParseError)) {
      throw error;
    }
    const invalid = error.invalidValues
      .map((entry) => entry.length === 0 ? "<empty>" : entry)
      .join(", ");
    throw new CliUsageError(
      `--allow contains unsupported permission(s): ${invalid}. ` +
      "Use READ, CREATE, UPDATE, or DELETE."
    );
  }
}

function requireArgumentCount(
  args: readonly string[],
  expected: number,
  command: string
): void {
  if (args.length !== expected) {
    throw new CliUsageError(`${command} does not accept additional arguments.`);
  }
}
