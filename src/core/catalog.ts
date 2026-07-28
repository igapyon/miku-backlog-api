import { allTools } from "backlog-mcp-server/build/tools/tools.js";
import type { CrudPermission, MutationClass } from "./contracts.js";
import { createLocalToolset } from "./local-tools.js";

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
    "get_myself",
    "get_notifications",
    "get_priorities",
    "get_project",
    "get_project_list",
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
    "get_wikis_count"
  ], "read", "READ"),
  ...policyEntries([
    "addDocument",
    "add_issue",
    "add_issue_comment",
    "add_project",
    "add_pull_request",
    "add_pull_request_comment",
    "add_version_milestone",
    "add_watching",
    "add_wiki"
  ], "mutation", "CREATE"),
  ...policyEntries([
    "mark_notification_as_read",
    "mark_watching_as_read",
    "update_issue",
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
    "delete_watching"
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

export function createToolsets(backlog: object = metadataOnlyClient) {
  return [
    ...allTools(backlog, fallbackTranslation).toolsets,
    createLocalToolset(backlog)
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

export function hasOperation(operationName: string): boolean {
  return createToolsets().some((toolset) =>
    toolset.tools.some((tool) => tool.name === operationName)
  );
}

export function resolveTool(backlog: object, operationName: string) {
  for (const toolset of createToolsets(backlog)) {
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
