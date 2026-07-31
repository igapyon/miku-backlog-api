import type {
  BacklogPaginationMetadata,
  BacklogResourceIdentifiers,
  CrudPermission
} from "./contracts.js";

interface InputAccessMetadata {
  target?: BacklogResourceIdentifiers;
  changedFields?: readonly string[];
  pagination?: BacklogPaginationMetadata;
}

type OptionalUndefined<T> = {
  [Key in keyof T]?: T[Key] | undefined;
};

type IdentifierCandidates = OptionalUndefined<BacklogResourceIdentifiers>;
type PaginationCandidates = OptionalUndefined<BacklogPaginationMetadata>;

const CONTEXT_FIELDS = new Set(["organization", "fields"]);
const TARGET_FIELDS = new Set([
  "spaceKey",
  "projectId",
  "projectKey",
  "projectIdOrKey",
  "issueId",
  "issueKey",
  "issueIdOrKey",
  "targetIssueId",
  "relatedIssueId",
  "wikiId",
  "repoId",
  "repoName",
  "repositoryId",
  "repositoryName",
  "pullRequestId",
  "number",
  "commentId"
]);

export function extractInputAccessMetadata(
  operation: string,
  input: Record<string, unknown>,
  permission: CrudPermission
): InputAccessMetadata {
  const target = compactIdentifiers({
    spaceKey: stringValue(input.spaceKey),
    ...idOrKey(input.projectId, input.projectKey, input.projectIdOrKey, "project"),
    ...idOrKey(input.issueId, input.issueKey, input.issueIdOrKey, "issue"),
    targetIssueId: numberValue(input.targetIssueId),
    relatedIssueId: numberValue(input.relatedIssueId),
    wikiId: numberValue(input.wikiId),
    repositoryId: numberValue(input.repositoryId) ?? numberValue(input.repoId),
    repositoryName: stringValue(input.repositoryName) ?? stringValue(input.repoName),
    pullRequestId: numberValue(input.pullRequestId),
    pullRequestNumber: operation.includes("pull_request")
      ? numberValue(input.number)
      : undefined,
    commentId: numberValue(input.commentId),
    attachmentId: numberOrNumberArray(input.attachmentId)
  });
  const pagination = compactPagination({
    offset: numberValue(input.offset),
    count: numberValue(input.count)
  });
  const changedFields = permission === "UPDATE"
    ? Object.keys(input)
        .filter((field) => !CONTEXT_FIELDS.has(field) && !TARGET_FIELDS.has(field))
        .sort()
    : [];

  return {
    ...(target === undefined ? {} : { target }),
    ...(changedFields.length === 0 ? {} : { changedFields }),
    ...(pagination === undefined ? {} : { pagination })
  };
}

export function extractResultIdentifiers(
  operation: string,
  result: unknown
): BacklogResourceIdentifiers | undefined {
  if (!isRecord(result)) {
    return undefined;
  }

  if (operation === "get_space") {
    return compactIdentifiers({ spaceKey: stringValue(result.spaceKey) });
  }
  if (operation.includes("pull_request_comment")) {
    return compactIdentifiers({ commentId: numberValue(result.id) });
  }
  if (operation.includes("pull_request")) {
    return compactIdentifiers({
      pullRequestId: numberValue(result.id),
      pullRequestNumber: numberValue(result.number)
    });
  }
  if (operation.includes("issue_comment")) {
    return compactIdentifiers({ commentId: numberValue(result.id) });
  }
  if (operation.includes("issue")) {
    return compactIdentifiers({
      issueId: numberValue(result.id),
      issueKey: stringValue(result.issueKey)
    });
  }
  if (operation.includes("project")) {
    return compactIdentifiers({
      projectId: numberValue(result.id),
      projectKey: stringValue(result.projectKey)
    });
  }
  if (operation.includes("wiki")) {
    return compactIdentifiers({ wikiId: numberValue(result.id) });
  }
  if (operation.includes("git_repository")) {
    return compactIdentifiers({
      repositoryId: numberValue(result.id),
      repositoryName: stringValue(result.name)
    });
  }
  if (operation.includes("attachment")) {
    return compactIdentifiers({ attachmentId: numberValue(result.id) });
  }
  return undefined;
}

export function extractHttpStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  const direct = numberValue(error.status) ?? numberValue(error.statusCode);
  if (direct !== undefined) {
    return httpStatus(direct);
  }
  return isRecord(error.response) ? httpStatus(numberValue(error.response.status)) : undefined;
}

function idOrKey(
  id: unknown,
  key: unknown,
  combined: unknown,
  resource: "project" | "issue"
): IdentifierCandidates {
  const numericId = numberOrNumberArray(id) ?? numberOrNumberArray(combined);
  const stringKey = stringValue(key) ?? stringValue(combined);
  return resource === "project"
    ? { projectId: numericId, projectKey: stringKey }
    : { issueId: numericId, issueKey: stringKey };
}

function compactIdentifiers(
  identifiers: IdentifierCandidates
): BacklogResourceIdentifiers | undefined {
  const entries = Object.entries(identifiers).filter(([, value]) => value !== undefined);
  return entries.length > 0
    ? Object.fromEntries(entries) as BacklogResourceIdentifiers
    : undefined;
}

function compactPagination(
  pagination: PaginationCandidates
): BacklogPaginationMetadata | undefined {
  const entries = Object.entries(pagination).filter(([, value]) => value !== undefined);
  return entries.length > 0
    ? Object.fromEntries(entries) as BacklogPaginationMetadata
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numberOrNumberArray(value: unknown): number | readonly number[] | undefined {
  const scalar = numberValue(value);
  if (scalar !== undefined) {
    return scalar;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const numbers = value.filter((entry): entry is number => numberValue(entry) !== undefined);
  return numbers.length > 0 ? numbers.slice(0, 20) : undefined;
}

function httpStatus(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
