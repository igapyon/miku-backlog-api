import type { CrudPermission } from "./contracts.js";

export const BACKLOG_API_ALLOWED_PERMISSIONS = "BACKLOG_API_ALLOWED_PERMISSIONS";

const DEFAULT_PERMISSIONS = Object.freeze(["READ"] satisfies CrudPermission[]);
const SUPPORTED_PERMISSIONS = new Set<CrudPermission>([
  "READ",
  "CREATE",
  "UPDATE",
  "DELETE"
]);

export function environmentAllowedPermissions(
  env: NodeJS.ProcessEnv
): readonly CrudPermission[] {
  const value = env[BACKLOG_API_ALLOWED_PERMISSIONS];
  if (value === undefined) {
    return DEFAULT_PERMISSIONS;
  }

  const entries = value.split(",").map((entry) => entry.trim().toUpperCase());
  if (
    entries.length === 0 ||
    entries.some((entry) => entry.length === 0) ||
    entries.some((entry) => !SUPPORTED_PERMISSIONS.has(entry as CrudPermission))
  ) {
    throw new Error(
      `${BACKLOG_API_ALLOWED_PERMISSIONS} must be a comma-separated list containing only ` +
      "READ, CREATE, UPDATE, and DELETE."
    );
  }

  return [...new Set(entries)] as CrudPermission[];
}
