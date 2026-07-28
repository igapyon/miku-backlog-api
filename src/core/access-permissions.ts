import type { CrudPermission } from "./contracts.js";

export const BACKLOG_API_ALLOWED_PERMISSIONS = "BACKLOG_API_ALLOWED_PERMISSIONS";

export const DEFAULT_CRUD_PERMISSIONS = Object.freeze(
  ["READ"] satisfies CrudPermission[]
);
export const CRUD_PERMISSIONS = Object.freeze([
  "READ",
  "CREATE",
  "UPDATE",
  "DELETE"
] satisfies CrudPermission[]);

const SUPPORTED_PERMISSIONS = new Set<CrudPermission>(CRUD_PERMISSIONS);

export class CrudPermissionParseError extends Error {
  readonly invalidValues: readonly string[];

  constructor(invalidValues: readonly string[]) {
    super("CRUD permissions contain empty or unsupported values.");
    this.name = "CrudPermissionParseError";
    this.invalidValues = invalidValues;
  }
}

export function parseCrudPermissions(value: string): readonly CrudPermission[] {
  const entries = value.split(",").map((entry) => entry.trim().toUpperCase());
  const invalidValues = entries.filter(
    (entry) => entry.length === 0 || !SUPPORTED_PERMISSIONS.has(entry as CrudPermission)
  );
  if (invalidValues.length > 0) {
    throw new CrudPermissionParseError(invalidValues);
  }
  return [...new Set(entries)] as CrudPermission[];
}

export function environmentAllowedPermissions(
  env: NodeJS.ProcessEnv
): readonly CrudPermission[] {
  const value = env[BACKLOG_API_ALLOWED_PERMISSIONS];
  if (value === undefined) {
    return DEFAULT_CRUD_PERMISSIONS;
  }

  try {
    return parseCrudPermissions(value);
  } catch (error) {
    if (!(error instanceof CrudPermissionParseError)) {
      throw error;
    }
    throw new Error(
      `${BACKLOG_API_ALLOWED_PERMISSIONS} must be a comma-separated list containing only ` +
      "READ, CREATE, UPDATE, and DELETE."
    );
  }
}
