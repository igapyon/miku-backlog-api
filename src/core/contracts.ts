export type CrudPermission = "READ" | "CREATE" | "UPDATE" | "DELETE";

export type MutationClass =
  | "read"
  | "mutation"
  | "destructive"
  | "broad-mutation";

export type DiagnosticCode =
  | "ACCESS_PERMISSION_REQUIRED"
  | "PERMISSION_REQUIRED"
  | "INVALID_INPUT"
  | "INVALID_FIELDS"
  | "CONFIRMATION_REQUIRED"
  | "CONFIGURATION_ERROR"
  | "ORGANIZATION_ERROR"
  | "UNKNOWN_OPERATION"
  | "INVALID_ARGUMENT"
  | "UPSTREAM_ERROR";

export interface Diagnostic {
  code: DiagnosticCode;
  severity: "error";
  message: string;
  path?: string;
}

export interface UpstreamTrace {
  origin: "upstream" | "miku-backlog-api";
  repository: string;
  version: string;
  commit?: string;
  operation: string;
  source: string | undefined;
  test: string | null | undefined;
}

export interface BacklogClientRegistry {
  resolveClient(organization?: string): object;
}

export type BacklogAccessPhase = "start" | "success" | "failure";

export interface BacklogResourceIdentifiers {
  spaceKey?: string;
  projectId?: number | readonly number[];
  projectKey?: string;
  issueId?: number | readonly number[];
  issueKey?: string;
  targetIssueId?: number;
  relatedIssueId?: number;
  wikiId?: number;
  repositoryId?: number;
  repositoryName?: string;
  pullRequestId?: number;
  pullRequestNumber?: number;
  commentId?: number;
  attachmentId?: number | readonly number[];
}

export interface BacklogPaginationMetadata {
  offset?: number;
  count?: number;
}

export interface BacklogRateLimitMetadata {
  limit?: number;
  remaining?: number;
  resetAt?: string;
}

export interface BacklogAccessEvent {
  phase: BacklogAccessPhase;
  access: number;
  operation: string;
  method: string;
  permission: CrudPermission;
  organization: "default" | "named";
  target?: BacklogResourceIdentifiers;
  result?: BacklogResourceIdentifiers;
  changedFields?: readonly string[];
  pagination?: BacklogPaginationMetadata;
  rateLimit?: BacklogRateLimitMetadata;
  durationMs?: number;
  httpStatus?: number;
}

export interface RunOperationOptions {
  allowedPermissions?: readonly CrudPermission[];
  confirmDestructive?: boolean;
  dryRun?: boolean;
  registry?: BacklogClientRegistry;
  env?: NodeJS.ProcessEnv;
  onAccess?: (event: BacklogAccessEvent) => void;
}

export interface OperationFailure {
  schemaVersion: 1;
  operation: string;
  toolset?: string;
  success: false;
  diagnostics: Diagnostic[];
  trace: UpstreamTrace;
}

export interface OperationSuccess {
  schemaVersion: 1;
  operation: string;
  toolset: string;
  success: true;
  result?: unknown;
  dryRun?: true;
  input?: unknown;
  diagnostics: [];
  trace: UpstreamTrace;
}

export type OperationResult = OperationSuccess | OperationFailure;
