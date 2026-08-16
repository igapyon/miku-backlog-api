import { parseBacklogAPIError } from "backlog-mcp-server/build/backlog/parseBacklogAPIError.js";
import {
  BACKLOG_API_ALLOWED_PERMISSIONS,
  DEFAULT_CRUD_PERMISSIONS,
  environmentAllowedPermissions
} from "./access-permissions.js";
import { createBacklogClientRegistry } from "./backlog-client-registry.js";
import {
  classifyMutation,
  hasOperation,
  requiredPermission,
  resolveTool
} from "./catalog.js";
import type {
  DiagnosticCode,
  OperationFailure,
  OperationResult,
  RunOperationOptions,
  UpstreamTrace
} from "./contracts.js";
import { selectResultFields, validateFieldsSelection } from "./field-selection.js";
import { validateOperationInputConstraints } from "./operation-input-constraints.js";
import { getUpstreamTrace } from "./traceability.js";
import { observeBacklogClient } from "./verbose-client.js";
import { isClientlessLocalOperation } from "./local-tools.js";

export async function runOperation(
  operation: string,
  input: unknown,
  options: RunOperationOptions = {}
): Promise<OperationResult> {
  const trace = getUpstreamTrace(operation);
  if (!hasOperation(operation)) {
    return failure(operation, "UNKNOWN_OPERATION", `Unknown operation: ${operation}`, trace);
  }
  let mutationClass;
  let permission;
  try {
    mutationClass = classifyMutation(operation);
    permission = requiredPermission(operation);
  } catch (error) {
    return failure(operation, "CONFIGURATION_ERROR", errorMessage(error), trace);
  }
  const env = options.env ?? process.env;
  let environmentPermissions;
  try {
    environmentPermissions = environmentAllowedPermissions(env);
  } catch (error) {
    return failure(operation, "CONFIGURATION_ERROR", errorMessage(error), trace);
  }

  if (!environmentPermissions.includes(permission)) {
    return failure(
      operation,
      "ACCESS_PERMISSION_REQUIRED",
      `Operation ${operation} requires ${permission}, but ${permission} is not enabled by ` +
      `${BACKLOG_API_ALLOWED_PERMISSIONS}.`,
      trace
    );
  }

  const callPermissions = options.allowedPermissions ?? DEFAULT_CRUD_PERMISSIONS;
  if (!callPermissions.includes(permission)) {
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

  const { organization, fields: _fields, ...toolInput } = request;
  if (organization !== undefined && typeof organization !== "string") {
    return failure(
      operation,
      "INVALID_ARGUMENT",
      "organization must be a string when provided.",
      trace
    );
  }

  const metadataResolved = resolveTool({}, operation);
  if (!metadataResolved) {
    return failure(operation, "UNKNOWN_OPERATION", `Unknown operation: ${operation}`, trace);
  }

  const localValidation = metadataResolved.toolset === "miku-backlog-api"
    ? validateToolInput(
      operation,
      metadataResolved.toolset,
      metadataResolved.tool.schema,
      toolInput,
      trace
    )
    : undefined;
  if (localValidation !== undefined && !localValidation.ok) {
    return localValidation.failure;
  }
  if (isClientlessLocalOperation(operation) && organization !== undefined) {
    return failure(
      operation,
      "INVALID_ARGUMENT",
      "organization is not valid for an operation that lists all configured organizations.",
      trace,
      metadataResolved.toolset
    );
  }

  if (options.dryRun === true) {
    const validation = localValidation ?? validateToolInput(
      operation,
      metadataResolved.toolset,
      metadataResolved.tool.schema,
      toolInput,
      trace
    );
    if (!validation.ok) {
      return validation.failure;
    }
    return {
      schemaVersion: 1,
      operation,
      toolset: metadataResolved.toolset,
      success: true,
      dryRun: true,
      input: validation.data,
      diagnostics: [],
      trace
    };
  }

  let registry;
  try {
    registry = options.registry ?? createBacklogClientRegistry({ env });
  } catch (error) {
    return failure(operation, "CONFIGURATION_ERROR", errorMessage(error), trace);
  }
  if (isClientlessLocalOperation(operation)) {
    const resolved = resolveTool({}, operation, registry);
    if (!resolved) {
      return failure(operation, "UNKNOWN_OPERATION", `Unknown operation: ${operation}`, trace);
    }
    const validation = localValidation ?? validateToolInput(
      operation,
      resolved.toolset,
      resolved.tool.schema,
      toolInput,
      trace
    );
    if (!validation.ok) {
      return validation.failure;
    }
    try {
      const result = await resolved.tool.handler(validation.data);
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
      return failure(
        operation,
        "CONFIGURATION_ERROR",
        errorMessage(error),
        trace,
        resolved.toolset
      );
    }
  }
  let backlog;
  try {
    backlog = registry.resolveClient(organization);
  } catch (error) {
    return failure(operation, "ORGANIZATION_ERROR", errorMessage(error), trace);
  }

  const organizationClass: "default" | "named" = organization === undefined
    ? "default"
    : "named";
  const verboseContext = {
    operation,
    permission,
    organization: organizationClass,
    input: {} as Record<string, unknown>,
    ...(options.onAccess === undefined ? {} : { onAccess: options.onAccess })
  };
  const observedBacklog = observeBacklogClient(backlog, verboseContext);
  const resolved = resolveTool(observedBacklog, operation);
  if (!resolved) {
    return failure(operation, "UNKNOWN_OPERATION", `Unknown operation: ${operation}`, trace);
  }
  const validation = localValidation ?? validateToolInput(
    operation,
    resolved.toolset,
    resolved.tool.schema,
    toolInput,
    trace
  );
  if (!validation.ok) {
    return validation.failure;
  }
  verboseContext.input = validation.record;

  try {
    const result = await resolved.tool.handler(validation.data);
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

interface ToolInputSchema {
  safeParse(input: unknown):
    | { success: true; data: unknown }
    | {
        success: false;
        error: {
          issues: Array<{ path: PropertyKey[]; message: string }>;
        };
      };
}

type ToolInputValidation =
  | { ok: true; data: unknown; record: Record<string, unknown> }
  | { ok: false; failure: OperationFailure };

function validateToolInput(
  operation: string,
  toolset: string,
  schema: ToolInputSchema,
  input: Record<string, unknown>,
  trace: UpstreamTrace
): ToolInputValidation {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      failure: {
        schemaVersion: 1,
        operation,
        toolset,
        success: false,
        diagnostics: parsed.error.issues.map((issue) => ({
          code: "INVALID_ARGUMENT",
          severity: "error",
          path: issue.path.map(String).join("."),
          message: issue.message
        })),
        trace
      }
    };
  }
  const record = isRecord(parsed.data) ? parsed.data : {};
  const constraintIssues = validateOperationInputConstraints(operation, record);
  if (constraintIssues.length > 0) {
    return {
      ok: false,
      failure: {
        schemaVersion: 1,
        operation,
        toolset,
        success: false,
        diagnostics: constraintIssues.map((issue) => ({
          code: "INVALID_ARGUMENT",
          severity: "error",
          ...issue
        })),
        trace
      }
    };
  }
  return { ok: true, data: parsed.data, record };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
