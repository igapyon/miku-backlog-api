import type { BacklogAccessEvent, CrudPermission } from "./contracts.js";

interface VerboseContext {
  operation: string;
  permission: CrudPermission;
  organization: "default" | "named";
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
        const event = {
          access,
          operation: context.operation,
          method: String(property),
          permission: context.permission,
          organization: context.organization
        } satisfies Omit<BacklogAccessEvent, "phase">;

        context.onAccess?.({ phase: "start", ...event });
        try {
          const result: unknown = await Reflect.apply(value, target, args);
          context.onAccess?.({ phase: "success", ...event });
          return result;
        } catch (error) {
          context.onAccess?.({ phase: "failure", ...event });
          throw error;
        }
      };
    }
  });
}
