import { backlogErrorHandler } from "backlog-mcp-server";
import {
  BACKLOG_API_ALLOWED_PERMISSIONS,
  DEFAULT_CRUD_PERMISSIONS,
  environmentAllowedPermissions
} from "./access-permissions.js";
import {
  capturedBacklogResponse,
  createBacklogAccessContext,
  runWithBacklogAccessContext
} from "./backlog-access-context.js";
import { createBacklogClientRegistry } from "./backlog-client-registry.js";
import {
  classifyMutation,
  hasOperation,
  requiredPermission,
  resolveTool
} from "./catalog.js";
import type {
  BacklogAccessEvent,
  CrudPermission,
  DownloadOperationResult,
  DownloadTransfer,
  OperationFailure,
  RunOperationOptions,
  UpstreamTrace
} from "./contracts.js";
import { isBinaryLocalOperation } from "./local-tools.js";
import { validateOperationInputConstraints } from "./operation-input-constraints.js";
import { getUpstreamTrace } from "./traceability.js";
import { extractHttpStatus, extractInputAccessMetadata } from "./verbose-metadata.js";

export async function openDownload(
  operation: string,
  input: unknown,
  options: RunOperationOptions = {}
): Promise<DownloadOperationResult> {
  const trace = getUpstreamTrace(operation);
  if (!hasOperation(operation) || !isBinaryLocalOperation(operation)) {
    return failure(
      operation,
      "UNKNOWN_OPERATION",
      `Unknown binary download operation: ${operation}`,
      trace
    );
  }

  let permission: CrudPermission;
  try {
    permission = requiredPermission(operation);
  } catch (error) {
    return failure(operation, "CONFIGURATION_ERROR", errorMessage(error), trace);
  }
  if (classifyMutation(operation) !== "read" || permission !== "READ") {
    return failure(
      operation,
      "CONFIGURATION_ERROR",
      `Binary download operation ${operation} must be a READ operation.`,
      trace
    );
  }

  const env = options.env ?? process.env;
  let environmentPermissions: readonly CrudPermission[];
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
  if (!isRecord(input)) {
    return failure(operation, "INVALID_INPUT", "Input must be a JSON object.", trace);
  }

  const { organization, fields, ...toolInput } = input;
  if (organization !== undefined && typeof organization !== "string") {
    return failure(
      operation,
      "INVALID_ARGUMENT",
      "organization must be a string when provided.",
      trace
    );
  }
  if (fields !== undefined) {
    return failure(
      operation,
      "INVALID_FIELDS",
      "fields is not supported for a binary download operation.",
      trace
    );
  }

  const metadataResolved = resolveTool({}, operation);
  if (metadataResolved === undefined) {
    return failure(operation, "UNKNOWN_OPERATION", `Unknown operation: ${operation}`, trace);
  }
  const validation = validateToolInput(
    operation,
    metadataResolved.toolset,
    metadataResolved.tool.schema,
    toolInput,
    trace
  );
  if (!validation.ok) {
    return validation.failure;
  }
  if (options.dryRun === true) {
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
  let backlog: object;
  try {
    backlog = registry.resolveClient(organization);
  } catch (error) {
    return failure(operation, "ORGANIZATION_ERROR", errorMessage(error), trace);
  }
  const resolved = resolveTool(backlog, operation);
  if (resolved === undefined) {
    return failure(operation, "UNKNOWN_OPERATION", `Unknown operation: ${operation}`, trace);
  }

  const access = createDownloadAccess(
    operation,
    permission,
    organization === undefined ? "default" : "named",
    validation.record,
    options.onAccess
  );
  access.start();
  const accessContext = createBacklogAccessContext();
  let fileData: unknown;
  try {
    fileData = await runWithBacklogAccessContext(
      accessContext,
      () => (resolved.tool.handler as (value: unknown) => Promise<unknown>)(validation.data)
    );
  } catch (error) {
    access.failure(capturedBacklogResponse(accessContext), error);
    return failure(
      operation,
      "UPSTREAM_ERROR",
      backlogErrorHandler(error).message ?? errorMessage(error),
      trace,
      resolved.toolset
    );
  }

  const source = asDownloadSource(fileData);
  if (source === undefined) {
    const error = new Error("Backlog download did not return a readable response body.");
    access.failure(capturedBacklogResponse(accessContext), error);
    return failure(operation, "UPSTREAM_ERROR", error.message, trace, resolved.toolset);
  }

  const transfer = trackTransfer(
    source.body,
    () => access.success(capturedBacklogResponse(accessContext)),
    (error) => access.failure(capturedBacklogResponse(accessContext), error)
  );
  return {
    schemaVersion: 1,
    operation,
    toolset: resolved.toolset,
    success: true,
    transfer: {
      ...transfer,
      ...(source.filename === undefined ? {} : { filename: source.filename }),
      ...(source.url === undefined ? {} : { url: source.url })
    },
    diagnostics: [],
    trace
  };
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

function createDownloadAccess(
  operation: string,
  permission: CrudPermission,
  organization: "default" | "named",
  input: Record<string, unknown>,
  onAccess: RunOperationOptions["onAccess"]
) {
  const startedAt = performance.now();
  const event = {
    access: 1,
    operation,
    method: methodName(operation),
    permission,
    organization,
    ...extractInputAccessMetadata(operation, input, permission)
  } satisfies Omit<BacklogAccessEvent, "phase">;
  let settled = false;

  function emit(
    phase: "success" | "failure",
    response: ReturnType<typeof capturedBacklogResponse>,
    error?: unknown
  ): void {
    if (settled) {
      return;
    }
    settled = true;
    const status = response?.httpStatus ?? (error === undefined ? undefined : extractHttpStatus(error));
    onAccess?.({
      phase,
      ...event,
      ...(status === undefined ? {} : { httpStatus: status }),
      ...(response?.rateLimit === undefined ? {} : { rateLimit: response.rateLimit }),
      durationMs: elapsedMilliseconds(startedAt)
    });
  }

  return {
    start() {
      onAccess?.({ phase: "start", ...event });
    },
    success(response: ReturnType<typeof capturedBacklogResponse>) {
      emit("success", response);
    },
    failure(response: ReturnType<typeof capturedBacklogResponse>, error: unknown) {
      emit("failure", response, error);
    }
  };
}

function trackTransfer(
  source: ReadableStream<Uint8Array>,
  onSuccess: () => void,
  onFailure: (error: unknown) => void
): Pick<DownloadTransfer, "body" | "completed"> {
  const reader = source.getReader();
  let settled = false;
  let resolveCompletion: () => void;
  let rejectCompletion: (reason?: unknown) => void;
  const completed = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  // A consumer normally awaits `completed` after consuming `body`. Attach a
  // rejection handler here as well so an interrupted stream cannot become an
  // unhandled rejection while a pipeline reports the same error first.
  void completed.catch(() => {});

  function success(): void {
    if (settled) {
      return;
    }
    settled = true;
    onSuccess();
    resolveCompletion();
  }

  function failure(error: unknown): void {
    if (settled) {
      return;
    }
    settled = true;
    onFailure(error);
    rejectCompletion(error);
  }

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          success();
          controller.close();
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        failure(error);
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        failure(reason instanceof Error ? reason : new Error("Download transfer cancelled."));
      }
    }
  });
  return { body, completed };
}

function asDownloadSource(value: unknown): {
  body: ReadableStream<Uint8Array>;
  filename?: string;
  url?: string;
} | undefined {
  if (!isRecord(value) || !isReadableStream(value.body)) {
    return undefined;
  }
  return {
    body: value.body,
    ...(typeof value.filename === "string" && value.filename.length > 0
      ? { filename: value.filename }
      : {}),
    ...(typeof value.url === "string" && value.url.length > 0 ? { url: value.url } : {})
  };
}

function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return typeof value === "object" && value !== null &&
    "getReader" in value && typeof value.getReader === "function";
}

function methodName(operation: string): string {
  switch (operation) {
    case "download_issue_attachment":
      return "getIssueAttachment";
    case "download_wiki_attachment":
      return "getWikiAttachment";
    case "download_shared_file":
      return "getSharedFile";
    default:
      return operation;
  }
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Math.round((performance.now() - startedAt) * 1000) / 1000);
}

function failure(
  operation: string,
  code: OperationFailure["diagnostics"][number]["code"],
  message: string,
  trace: UpstreamTrace,
  toolset?: string
): OperationFailure {
  return {
    schemaVersion: 1,
    operation,
    ...(toolset === undefined ? {} : { toolset }),
    success: false,
    diagnostics: [{ code, severity: "error", message }],
    trace
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
