import { allTools } from "backlog-mcp-server";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { BacklogClientRegistry, CrudPermission, MutationClass } from "./contracts.js";
import { createLocalToolset } from "./local-tools.js";
import { getAlternativeFieldConstraints } from "./operation-input-constraints.js";

interface OperationPolicy {
  mutationClass: MutationClass;
  requiredPermission: CrudPermission;
}

const OPERATION_POLICIES = new Map<string, OperationPolicy>([
  ...policyEntries([
    "count_issues",
    "count_notifications",
    "get_categories",
    "get_custom_fields",
    "get_document",
    "get_document_tree",
    "get_documents",
    "get_git_repositories",
    "get_git_repository",
    "get_issue",
    "get_issue_comments",
    "get_issue_types",
    "get_issues",
    "get_related_issues",
    "get_myself",
    "get_notifications",
    "get_priorities",
    "get_project",
    "get_project_list",
    "get_project_statuses",
    "get_project_users",
    "get_pull_request",
    "get_pull_request_comments",
    "get_pull_requests",
    "get_pull_requests_count",
    "get_rate_limit",
    "get_resolutions",
    "get_space",
    "get_space_activities",
    "get_user_recent_updates",
    "get_user_stars_count",
    "get_users",
    "get_version_milestone_list",
    "get_watching_list_count",
    "get_watching_list_items",
    "get_wiki",
    "get_wiki_pages",
    "get_wikis_count",
    "list_organizations"
  ], "read", "READ"),
  ...policyEntries([
    "addDocument",
    "add_issue",
    "add_issue_comment",
    "add_project",
    "add_pull_request",
    "add_pull_request_comment",
    "add_related_issue",
    "add_version_milestone",
    "add_watching",
    "add_wiki"
  ], "mutation", "CREATE"),
  ...policyEntries([
    "mark_notification_as_read",
    "mark_watching_as_read",
    "update_issue",
    "update_issue_comment",
    "update_project",
    "update_pull_request",
    "update_pull_request_comment",
    "update_version_milestone",
    "update_watching",
    "update_wiki"
  ], "mutation", "UPDATE"),
  ...policyEntries([
    "delete_issue",
    "delete_project",
    "delete_version",
    "delete_watching",
    "remove_related_issue"
  ], "destructive", "DELETE"),
  ...policyEntries([
    "reset_unread_notification_count"
  ], "broad-mutation", "UPDATE")
]);

const fallbackTranslation = {
  t(_key: string, fallback: string): string {
    return fallback;
  },
  dump(): Record<string, never> {
    return {};
  }
};

const metadataOnlyClient = new Proxy({}, {
  get(_target, property) {
    return async () => {
      throw new Error(
        `Backlog client method ${String(property)} cannot run during metadata discovery.`
      );
    };
  }
});

export function createToolsets(
  backlog: object = metadataOnlyClient,
  localRegistry?: BacklogClientRegistry
) {
  return [
    ...allTools(backlog as Parameters<typeof allTools>[0], fallbackTranslation).toolsets,
    createLocalToolset(backlog, {
      ...(localRegistry === undefined ? {} : { registry: localRegistry })
    })
  ];
}

export function listOperations() {
  return createToolsets()
    .flatMap((toolset) => toolset.tools.map((tool) => {
      const policy = requireOperationPolicy(tool.name);
      return {
        name: tool.name,
        description: tool.description,
        toolset: toolset.name,
        ...policy
      };
    }))
    .sort((left, right) => compareUtf16(left.name, right.name));
}

export function describeOperation(operationName: string) {
  const resolved = resolveTool(metadataOnlyClient, operationName);
  if (resolved === undefined) {
    return undefined;
  }
  const policy = requireOperationPolicy(operationName);
  const inputSchema = addCliInputMetadata(
    toJsonSchema(resolved.tool.schema),
    operationName
  );
  const outputSchema = hasOutputSchema(resolved.tool)
    ? toJsonSchema(resolved.tool.outputSchema)
    : undefined;
  const outputFields = hasOutputFields(resolved.tool)
    ? resolved.tool.outputFields.map(String)
    : undefined;
  const examples = OPERATION_EXAMPLES.get(operationName);
  return {
    name: resolved.tool.name,
    description: resolved.tool.description,
    toolset: resolved.toolset,
    ...policy,
    requiresConfirmation:
      policy.mutationClass === "destructive" ||
      policy.mutationClass === "broad-mutation",
    supportsDryRun: true,
    credentialsRequiredForDryRun: false,
    inputSchema,
    ...(outputSchema === undefined ? {} : { outputFieldSchema: outputSchema }),
    ...(outputFields === undefined ? {} : { outputFields }),
    ...(resolved.tool.importantFields === undefined
      ? {}
      : { importantOutputFields: resolved.tool.importantFields }),
    ...(examples === undefined ? {} : { examples })
  };
}

export function hasOperation(operationName: string): boolean {
  return createToolsets().some((toolset) =>
    toolset.tools.some((tool) => tool.name === operationName)
  );
}

export function resolveTool(
  backlog: object,
  operationName: string,
  localRegistry?: BacklogClientRegistry
) {
  for (const toolset of createToolsets(backlog, localRegistry)) {
    const tool = toolset.tools.find((candidate) => candidate.name === operationName);
    if (tool) {
      return { tool, toolset: toolset.name };
    }
  }
  return undefined;
}

export function classifyMutation(operationName: string): MutationClass {
  return requireOperationPolicy(operationName).mutationClass;
}

export function requiredPermission(operationName: string): CrudPermission {
  return requireOperationPolicy(operationName).requiredPermission;
}

function requireOperationPolicy(operationName: string): OperationPolicy {
  const policy = OPERATION_POLICIES.get(operationName);
  if (policy === undefined) {
    throw new Error(`Operation ${operationName} has no declared access policy.`);
  }
  return policy;
}

function policyEntries(
  operationNames: readonly string[],
  mutationClass: MutationClass,
  requiredPermission: CrudPermission
): Array<[string, OperationPolicy]> {
  return operationNames.map((operationName) => [
    operationName,
    { mutationClass, requiredPermission }
  ]);
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

type JsonObject = Record<string, unknown>;

const OPERATION_EXAMPLES = new Map<string, readonly JsonObject[]>([
  ["list_organizations", [{}]],
  ["get_issue", [{ issueKey: "PROJ-1" }, { issueId: 12345 }]],
  ["get_related_issues", [{ issueKey: "PROJ-1" }, { issueId: 12345 }]],
  ["get_project", [{ projectKey: "PROJ" }, { projectId: 12345 }]],
  ["get_project_statuses", [{ projectKey: "PROJ" }, { projectId: 12345 }]],
  ["get_rate_limit", [{}]],
  [
    "add_issue",
    [{
      projectId: 12345,
      summary: "Example issue",
      issueTypeId: 1,
      priorityId: 3
    }]
  ],
  ["add_related_issue", [{ issueKey: "PROJ-1", targetIssueId: 12346 }]],
  ["remove_related_issue", [{ issueKey: "PROJ-1", relatedIssueId: 12346 }]],
  [
    "update_issue_comment",
    [{ issueKey: "PROJ-1", commentId: 12345, content: "Updated comment" }]
  ],
  ["delete_issue", [{ issueKey: "PROJ-1" }]]
]);

function toJsonSchema(schema: unknown): JsonObject {
  if (hasToJsonSchema(schema)) {
    return schema.toJSONSchema();
  }
  return zodToJsonSchema(
    schema as Parameters<typeof zodToJsonSchema>[0],
    { target: "jsonSchema7" }
  ) as JsonObject;
}

function hasToJsonSchema(value: unknown): value is { toJSONSchema(): JsonObject } {
  return typeof value === "object" && value !== null &&
    "toJSONSchema" in value && typeof value.toJSONSchema === "function";
}

function hasOutputSchema(value: object): value is { outputSchema: unknown } {
  return "outputSchema" in value && value.outputSchema !== undefined;
}

function hasOutputFields(
  value: object
): value is { outputFields: readonly PropertyKey[] } {
  return "outputFields" in value && Array.isArray(value.outputFields);
}

function addCliInputMetadata(
  schema: JsonObject,
  operationName: string
): JsonObject {
  const properties = isJsonObject(schema.properties)
    ? schema.properties
    : {};
  const constraints = getAlternativeFieldConstraints(operationName);
  const existingAllOf = Array.isArray(schema.allOf) ? schema.allOf : [];
  return {
    ...schema,
    properties: {
      ...properties,
      organization: {
        type: "string",
        description:
          "Configured Backlog organization name. Omit to use the default connection."
      },
      fields: {
        type: "string",
        description:
          'GraphQL-style result field selection, for example "{ id summary }".'
      }
    },
    ...(constraints.length === 0
      ? {}
      : {
          allOf: [
            ...existingAllOf,
            ...constraints.map((constraint) => ({
              description: constraint.message,
              anyOf: constraint.fields.map((field) => ({
                required: [field]
              }))
            }))
          ]
        })
  };
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
