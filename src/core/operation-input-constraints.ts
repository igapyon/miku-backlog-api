export interface AlternativeFieldConstraint {
  fields: readonly [string, string];
  message: string;
}

const ISSUE_ID_OR_KEY_OPERATIONS = [
  "add_issue_comment",
  "delete_issue",
  "get_issue",
  "get_issue_comments",
  "update_issue"
] as const;

const PROJECT_ID_OR_KEY_OPERATIONS = [
  "add_pull_request",
  "add_pull_request_comment",
  "add_version_milestone",
  "delete_project",
  "delete_version",
  "get_categories",
  "get_custom_fields",
  "get_git_repositories",
  "get_git_repository",
  "get_issue_types",
  "get_project",
  "get_project_users",
  "get_pull_request",
  "get_pull_request_comments",
  "get_pull_requests",
  "get_pull_requests_count",
  "get_version_milestone_list",
  "get_wiki_pages",
  "get_wikis_count",
  "update_project",
  "update_pull_request",
  "update_pull_request_comment",
  "update_version_milestone"
] as const;

const REPOSITORY_ID_OR_NAME_OPERATIONS = [
  "add_pull_request",
  "add_pull_request_comment",
  "get_git_repository",
  "get_pull_request",
  "get_pull_request_comments",
  "get_pull_requests",
  "get_pull_requests_count",
  "update_pull_request",
  "update_pull_request_comment"
] as const;

const constraintsByOperation = new Map<string, AlternativeFieldConstraint[]>();

addConstraints(ISSUE_ID_OR_KEY_OPERATIONS, {
  fields: ["issueId", "issueKey"],
  message: "Issue ID or key is required."
});
addConstraints(PROJECT_ID_OR_KEY_OPERATIONS, {
  fields: ["projectId", "projectKey"],
  message: "Project ID or key is required."
});
addConstraints(REPOSITORY_ID_OR_NAME_OPERATIONS, {
  fields: ["repoId", "repoName"],
  message: "Repository ID or name is required."
});

export function getAlternativeFieldConstraints(
  operation: string
): readonly AlternativeFieldConstraint[] {
  return constraintsByOperation.get(operation) ?? [];
}

export function validateOperationInputConstraints(
  operation: string,
  input: Record<string, unknown>
): Array<{ path: string; message: string }> {
  return getAlternativeFieldConstraints(operation)
    .filter((constraint) =>
      constraint.fields.every((field) => input[field] === undefined)
    )
    .map((constraint) => ({
      path: constraint.fields.join("|"),
      message: constraint.message
    }));
}

function addConstraints(
  operations: readonly string[],
  constraint: AlternativeFieldConstraint
): void {
  for (const operation of operations) {
    const constraints = constraintsByOperation.get(operation) ?? [];
    constraints.push(constraint);
    constraintsByOperation.set(operation, constraints);
  }
}
