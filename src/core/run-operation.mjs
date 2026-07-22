import { parseBacklogAPIError } from "backlog-mcp-server/build/backlog/parseBacklogAPIError.js";
import { createBacklogClientRegistry } from "backlog-mcp-server/build/utils/backlogClientRegistry.js";
import { classifyMutation, resolveTool } from "./catalog.mjs";
import { getUpstreamTrace } from "./traceability.mjs";

export async function runOperation(operation, input, options = {}) {
  const trace = getUpstreamTrace(operation);
  const mutationClass = classifyMutation(operation);

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return failure(operation, "INVALID_INPUT", "Input must be a JSON object.", trace);
  }

  if (
    (mutationClass === "destructive" || mutationClass === "broad-mutation") &&
    options.confirmDestructive !== true
  ) {
    return failure(
      operation,
      "CONFIRMATION_REQUIRED",
      `Operation ${operation} requires explicit destructive-operation confirmation.`,
      trace
    );
  }

  let registry;
  try {
    registry = options.registry ?? createBacklogClientRegistry({ env: options.env });
  } catch (error) {
    return failure(operation, "CONFIGURATION_ERROR", errorMessage(error), trace);
  }

  const { organization, ...toolInput } = input;
  let backlog;
  try {
    backlog = registry.resolveClient(organization);
  } catch (error) {
    return failure(operation, "ORGANIZATION_ERROR", errorMessage(error), trace);
  }

  const resolved = resolveTool(backlog, operation);
  if (!resolved) {
    return failure(operation, "UNKNOWN_OPERATION", `Unknown operation: ${operation}`, trace);
  }

  const parsed = resolved.tool.schema.safeParse(toolInput);
  if (!parsed.success) {
    return {
      schemaVersion: 1,
      operation,
      toolset: resolved.toolset,
      success: false,
      diagnostics: parsed.error.issues.map((issue) => ({
        code: "INVALID_ARGUMENT",
        severity: "error",
        path: issue.path.join("."),
        message: issue.message
      })),
      trace
    };
  }

  if (options.dryRun === true) {
    return {
      schemaVersion: 1,
      operation,
      toolset: resolved.toolset,
      success: true,
      dryRun: true,
      input: parsed.data,
      diagnostics: [],
      trace
    };
  }

  try {
    const result = await resolved.tool.handler(parsed.data);
    return {
      schemaVersion: 1,
      operation,
      toolset: resolved.toolset,
      success: true,
      result,
      diagnostics: [],
      trace
    };
  } catch (error) {
    const parsedError = parseBacklogAPIError(error);
    return failure(
      operation,
      "UPSTREAM_ERROR",
      parsedError?.message ?? errorMessage(error),
      trace,
      resolved.toolset
    );
  }
}

function failure(operation, code, message, trace, toolset) {
  return {
    schemaVersion: 1,
    operation,
    ...(toolset ? { toolset } : {}),
    success: false,
    diagnostics: [{ code, severity: "error", message }],
    trace
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
