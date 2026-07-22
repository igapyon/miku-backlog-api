import { parseBacklogAPIError } from "backlog-mcp-server/build/backlog/parseBacklogAPIError.js";
import { createBacklogClientRegistry } from "backlog-mcp-server/build/utils/backlogClientRegistry.js";
import { classifyMutation, requiredPermission, resolveTool } from "./catalog.js";
import type {
  DiagnosticCode,
  OperationFailure,
  OperationResult,
  RunOperationOptions,
  UpstreamTrace
} from "./contracts.js";
import { selectResultFields, validateFieldsSelection } from "./field-selection.js";
import { getUpstreamTrace } from "./traceability.js";
import { observeBacklogClient } from "./verbose-client.js";

export async function runOperation(
  operation: string,
  input: unknown,
  options: RunOperationOptions = {}
): Promise<OperationResult> {
  const trace = getUpstreamTrace(operation);
  const mutationClass = classifyMutation(operation);
  const permission = requiredPermission(operation);

  if (
    options.allowedPermissions !== undefined &&
    !options.allowedPermissions.includes(permission)
  ) {
    return failure(
      operation,
      "PERMISSION_REQUIRED",
      `Operation ${operation} requires ${permission} permission. Add it with --allow ${permission}.`,
      trace
    );
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return failure(operation, "INVALID_INPUT", "Input must be a JSON object.", trace);
  }

  const request = input as Record<string, unknown>;
  const fields = request.fields;
  try {
    await validateFieldsSelection(fields);
  } catch (error) {
    return failure(operation, "INVALID_FIELDS", errorMessage(error), trace);
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
    registry = options.registry ?? createBacklogClientRegistry(
      options.env === undefined ? {} : { env: options.env }
    );
  } catch (error) {
    return failure(operation, "CONFIGURATION_ERROR", errorMessage(error), trace);
  }

  const { organization, fields: _fields, ...toolInput } = request;
  if (organization !== undefined && typeof organization !== "string") {
    return failure(
      operation,
      "INVALID_ARGUMENT",
      "organization must be a string when provided.",
      trace
    );
  }
  let backlog;
  try {
    backlog = registry.resolveClient(organization);
  } catch (error) {
    return failure(operation, "ORGANIZATION_ERROR", errorMessage(error), trace);
  }

  const observedBacklog = observeBacklogClient(backlog, {
    operation,
    permission,
    organization: organization === undefined ? "default" : "named",
    ...(options.onAccess === undefined ? {} : { onAccess: options.onAccess })
  });
  const resolved = resolveTool(observedBacklog, operation);
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
        path: issue.path.map(String).join("."),
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
    const selectedResult = await selectResultFields(result, fields);
    return {
      schemaVersion: 1,
      operation,
      toolset: resolved.toolset,
      success: true,
      result: selectedResult,
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

function failure(
  operation: string,
  code: DiagnosticCode,
  message: string,
  trace: UpstreamTrace,
  toolset?: string
): OperationFailure {
  return {
    schemaVersion: 1,
    operation,
    ...(toolset ? { toolset } : {}),
    success: false,
    diagnostics: [{ code, severity: "error", message }],
    trace
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
