import type { BacklogAccessEvent, CrudPermission } from "./contracts.js";
import {
  capturedBacklogResponse,
  createBacklogAccessContext,
  runWithBacklogAccessContext
} from "./backlog-access-context.js";
import {
  extractHttpStatus,
  extractInputAccessMetadata,
  extractResultIdentifiers
} from "./verbose-metadata.js";

interface VerboseContext {
  operation: string;
  permission: CrudPermission;
  organization: "default" | "named";
  input: Record<string, unknown>;
  onAccess?: (event: BacklogAccessEvent) => void;
}

export function observeBacklogClient<T extends object>(
  client: T,
  context: VerboseContext
): T {
  if (context.onAccess === undefined) {
    return client;
  }

  let access = 0;
  return new Proxy(client, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== "function") {
        return value;
      }

      return async (...args: unknown[]) => {
        access += 1;
        const startedAt = performance.now();
        const inputMetadata = extractInputAccessMetadata(
          context.operation,
          context.input,
          context.permission
        );
        const event = {
          access,
          operation: context.operation,
          method: String(property),
          permission: context.permission,
          organization: context.organization,
          ...inputMetadata
        } satisfies Omit<BacklogAccessEvent, "phase">;

        context.onAccess?.({ phase: "start", ...event });
        const accessContext = createBacklogAccessContext();
        try {
          const result: unknown = await runWithBacklogAccessContext(
            accessContext,
            async () => Reflect.apply(value, target, args)
          );
          const response = capturedBacklogResponse(accessContext);
          const resultIdentifiers = extractResultIdentifiers(context.operation, result);
          context.onAccess?.({
            phase: "success",
            ...event,
            ...(resultIdentifiers === undefined ? {} : { result: resultIdentifiers }),
            ...(response?.httpStatus === undefined
              ? {}
              : { httpStatus: response.httpStatus }),
            ...(response?.rateLimit === undefined
              ? {}
              : { rateLimit: response.rateLimit }),
            durationMs: elapsedMilliseconds(startedAt)
          });
          return result;
        } catch (error) {
          const response = capturedBacklogResponse(accessContext);
          const status = response?.httpStatus ?? extractHttpStatus(error);
          context.onAccess?.({
            phase: "failure",
            ...event,
            durationMs: elapsedMilliseconds(startedAt),
            ...(status === undefined ? {} : { httpStatus: status }),
            ...(response?.rateLimit === undefined
              ? {}
              : { rateLimit: response.rateLimit })
          });
          throw error;
        }
      };
    }
  });
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Math.round((performance.now() - startedAt) * 1000) / 1000);
}
