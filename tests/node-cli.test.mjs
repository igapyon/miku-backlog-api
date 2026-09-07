import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const CLI = "bundle/miku-backlog-api.mjs";

test("package exposes the canonical and compatibility CLI names", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
  );

  assert.equal(packageJson.bin["miku-backlog-api"], "dist/cli.mjs");
  assert.equal(packageJson.bin["backlog-api"], "dist/cli.mjs");
});

test("CLI metadata commands do not require credentials", () => {
  const version = run(["--version"]);
  assert.equal(version.status, 0);
  assert.equal(version.stdout, "0.7.8\n");
  assert.equal(version.stderr, "");

  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.equal(help.stderr, "");
  assert.match(help.stdout, /miku-backlog-api call <operation>/);
  assert.match(help.stdout, /miku-backlog-api download <operation>/);
  assert.match(help.stdout, /tools describe <operation>/);
  assert.match(help.stdout, /Agent discovery:/);
  assert.match(help.stdout, /machine-readable JSON to stdout/);
  assert.match(help.stdout, /--confirm-destructive/);
  assert.match(help.stdout, /--verbose/);
  assert.match(help.stdout, /resource IDs\/keys/);
  assert.match(help.stdout, /under target/);
  assert.match(help.stdout, /Exit codes:/);
  assert.match(help.stdout, /BACKLOG_API_ALLOWED_PERMISSIONS/);
  assert.match(help.stdout, /READ is not added\s+implicitly/);
  assert.match(help.stdout, /requires its permission in both/);
  assert.match(help.stdout, /configuration errors detected before/);
  assert.match(help.stdout, /Unknown options, duplicate options/);
  assert.doesNotMatch(
    help.stdout,
    /^\s*miku-backlog-api call delete_issue .*--allow DELETE/m
  );

  const catalog = JSON.parse(run(["tools", "list"]).stdout);
  assert.equal(catalog.product.name, "miku-backlog-api");
  assert.equal(catalog.product.version, "0.7.8");
  assert.equal(catalog.operations.length, 69);
  assert.equal(
    catalog.operations.find((operation) => operation.name === "get_issue").requiredPermission,
    "READ"
  );
  assert.equal(
    catalog.operations.find((operation) => operation.name === "add_issue").requiredPermission,
    "CREATE"
  );
  assert.equal(
    catalog.operations.find((operation) => operation.name === "get_rate_limit").requiredPermission,
    "READ"
  );
  assert.equal(
    catalog.operations.find((operation) => operation.name === "get_project_statuses")
      .requiredPermission,
    "READ"
  );
  assert.equal(
    catalog.operations.find((operation) => operation.name === "list_organizations")
      .requiredPermission,
    "READ"
  );
  for (const operationName of [
    "get_shared_files",
    "download_issue_attachment",
    "download_wiki_attachment",
    "download_shared_file"
  ]) {
    assert.equal(
      catalog.operations.find((operation) => operation.name === operationName).requiredPermission,
      "READ"
    );
  }
  assert.equal(
    catalog.operations.find((operation) => operation.name === "get_related_issues")
      .requiredPermission,
    "READ"
  );
  assert.equal(
    catalog.operations.find((operation) => operation.name === "add_related_issue")
      .requiredPermission,
    "CREATE"
  );
  assert.equal(
    catalog.operations.find((operation) => operation.name === "update_issue_comment")
      .requiredPermission,
    "UPDATE"
  );
  assert.equal(
    catalog.operations.find((operation) => operation.name === "remove_related_issue")
      .requiredPermission,
    "DELETE"
  );

  const description = JSON.parse(run(["tools", "describe", "get_issue"]).stdout);
  assert.equal(description.operation.name, "get_issue");
  assert.equal(description.operation.requiredPermission, "READ");
  assert.equal(description.operation.requiresConfirmation, false);
  assert.equal(description.operation.credentialsRequiredForDryRun, false);
  assert.equal(description.operation.inputSchema.properties.issueId.type, "number");
  assert.equal(description.operation.inputSchema.properties.issueKey.type, "string");
  assert.equal(description.operation.inputSchema.properties.organization.type, "string");
  assert.equal(description.operation.inputSchema.properties.fields.type, "string");
  assert.deepEqual(description.operation.inputSchema.allOf[0].anyOf, [
    { required: ["issueId"] },
    { required: ["issueKey"] }
  ]);
  assert.equal(description.operation.outputFieldSchema, undefined);
  assert.equal(description.operation.outputFields.includes("summary"), true);
  assert.equal(description.operation.outputFields.includes("childIssueSummary"), true);
  assert.deepEqual(description.operation.examples, [
    { issueKey: "PROJ-1" },
    { issueId: 12345 }
  ]);

  const relatedDescription = JSON.parse(
    run(["tools", "describe", "add_related_issue"]).stdout
  );
  assert.equal(relatedDescription.operation.requiredPermission, "CREATE");
  assert.equal(relatedDescription.operation.requiresConfirmation, false);
  assert.equal(relatedDescription.operation.inputSchema.properties.targetIssueId.type, "number");
  assert.deepEqual(relatedDescription.operation.inputSchema.allOf[0].anyOf, [
    { required: ["issueId"] },
    { required: ["issueKey"] }
  ]);

  const removeRelatedDescription = JSON.parse(
    run(["tools", "describe", "remove_related_issue"]).stdout
  );
  assert.equal(removeRelatedDescription.operation.requiredPermission, "DELETE");
  assert.equal(removeRelatedDescription.operation.requiresConfirmation, true);

  const alias = JSON.parse(run(["call", "get_issue", "--help"]).stdout);
  assert.deepEqual(alias, description);

  const localDescription = JSON.parse(
    run(["tools", "describe", "get_rate_limit"]).stdout
  );
  assert.deepEqual(localDescription.operation.inputSchema.required, undefined);
  assert.equal(
    localDescription.operation.outputFieldSchema.properties.rateLimit.type,
    "object"
  );

  const projectStatusesDescription = JSON.parse(
    run(["tools", "describe", "get_project_statuses"]).stdout
  );
  assert.equal(projectStatusesDescription.operation.requiredPermission, "READ");
  assert.equal(projectStatusesDescription.operation.inputSchema.properties.projectId.type, "number");
  assert.equal(projectStatusesDescription.operation.inputSchema.properties.projectKey.type, "string");
  assert.deepEqual(projectStatusesDescription.operation.inputSchema.allOf[0].anyOf, [
    { required: ["projectId"] },
    { required: ["projectKey"] }
  ]);
  assert.equal(projectStatusesDescription.operation.outputFieldSchema.type, "array");

  const organizationsDescription = JSON.parse(
    run(["tools", "describe", "list_organizations"]).stdout
  );
  assert.equal(organizationsDescription.operation.requiredPermission, "READ");
  assert.equal(organizationsDescription.operation.outputFieldSchema.type, "array");
  assert.deepEqual(organizationsDescription.operation.examples, [{}]);

  const downloadDescription = JSON.parse(
    run(["tools", "describe", "download_issue_attachment"]).stdout
  );
  assert.equal(downloadDescription.operation.outputMode, "binary");
  assert.equal(downloadDescription.operation.outputFieldSchema, undefined);
  assert.equal(downloadDescription.operation.outputFields, undefined);
  assert.equal(downloadDescription.operation.inputSchema.properties.issueId.type, "integer");
  assert.equal(downloadDescription.operation.inputSchema.properties.attachmentId.type, "integer");
  assert.deepEqual(downloadDescription.operation.inputSchema.allOf[0].anyOf, [
    { required: ["issueId"] },
    { required: ["issueKey"] }
  ]);
});

test("CLI dry-run validates complete input without Backlog credentials", () => {
  const valid = run(
    ["call", "get_issue", "--input", "-", "--dry-run"],
    '{"issueKey":"TEST-1"}'
  );
  assert.equal(valid.status, 0);
  assert.equal(JSON.parse(valid.stdout).dryRun, true);

  for (const [operation, path] of [
    ["get_issue", "issueId|issueKey"],
    ["get_related_issues", "issueId|issueKey"],
    ["get_project", "projectId|projectKey"],
    ["get_project_statuses", "projectId|projectKey"]
  ]) {
    const invalid = run(["call", operation, "--input", "-", "--dry-run"], "{}");
    assert.equal(invalid.status, 2);
    const body = JSON.parse(invalid.stdout);
    assert.equal(body.diagnostics[0].code, "INVALID_ARGUMENT");
    assert.equal(body.diagnostics[0].path, path);
  }

  const write = run(
    ["call", "add_issue", "--input", "-", "--allow", "CREATE", "--dry-run"],
    '{"projectId":1,"summary":"Test","issueTypeId":2,"priorityId":3}',
    { BACKLOG_API_ALLOWED_PERMISSIONS: "CREATE" }
  );
  assert.equal(write.status, 0);
  assert.equal(JSON.parse(write.stdout).dryRun, true);

  const updateComment = run(
    ["call", "update_issue_comment", "--input", "-", "--allow", "UPDATE", "--dry-run"],
    '{"issueKey":"TEST-1","commentId":2,"content":"updated"}',
    { BACKLOG_API_ALLOWED_PERMISSIONS: "UPDATE" }
  );
  assert.equal(updateComment.status, 0);
  assert.equal(JSON.parse(updateComment.stdout).dryRun, true);

  const organizationDiscovery = run(
    ["call", "list_organizations", "--input", "-", "--dry-run"],
    "{}"
  );
  assert.equal(organizationDiscovery.status, 0);
  assert.equal(JSON.parse(organizationDiscovery.stdout).dryRun, true);

  const download = run(
    ["download", "download_issue_attachment", "--input", "-", "--output", "attachment.bin", "--dry-run"],
    '{"issueKey":"TEST-1","attachmentId":1}'
  );
  assert.equal(download.status, 0);
  assert.equal(JSON.parse(download.stdout).dryRun, true);
});

test("CLI allows READ only by default and checks permissions before credentials", () => {
  const denied = run(["call", "add_issue", "--input", "-"], "{}");
  assert.equal(denied.status, 1);
  assert.equal(
    JSON.parse(denied.stdout).diagnostics[0].code,
    "ACCESS_PERMISSION_REQUIRED"
  );

  const callDenied = run(
    ["call", "add_issue", "--input", "-"],
    "{}",
    { BACKLOG_API_ALLOWED_PERMISSIONS: "READ,CREATE" }
  );
  assert.equal(callDenied.status, 1);
  assert.equal(JSON.parse(callDenied.stdout).diagnostics[0].code, "PERMISSION_REQUIRED");

  const allowed = run(
    ["call", "add_issue", "--input", "-", "--allow", "READ,CREATE"],
    "{}",
    { BACKLOG_API_ALLOWED_PERMISSIONS: "READ,CREATE" }
  );
  assert.equal(allowed.status, 1);
  assert.equal(JSON.parse(allowed.stdout).diagnostics[0].code, "CONFIGURATION_ERROR");

  const invalid = run(["call", "get_issue", "--input", "-", "--allow", "EXECUTE"], "{}");
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /unsupported permission/);
});

test("CLI returns a structured confirmation error for destructive calls", () => {
  const result = run(
    ["call", "delete_issue", "--input", "-", "--allow", "DELETE"],
    '{"issueKey":"TEST-1"}',
    { BACKLOG_API_ALLOWED_PERMISSIONS: "DELETE" }
  );
  assert.equal(result.status, 1);
  const body = JSON.parse(result.stdout);
  assert.equal(body.success, false);
  assert.equal(body.diagnostics[0].code, "CONFIRMATION_REQUIRED");

  const removeRelated = run(
    ["call", "remove_related_issue", "--input", "-", "--allow", "DELETE"],
    '{"issueKey":"TEST-1","relatedIssueId":2}',
    { BACKLOG_API_ALLOWED_PERMISSIONS: "DELETE" }
  );
  assert.equal(removeRelated.status, 1);
  assert.equal(JSON.parse(removeRelated.stdout).diagnostics[0].code, "CONFIRMATION_REQUIRED");
});

test("CLI reports invalid fields as a structured usage failure", () => {
  const result = run(
    ["call", "get_issue", "--input", "-"],
    '{"issueKey":"TEST-1","fields":"id summary"}'
  );
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  assert.equal(JSON.parse(result.stdout).diagnostics[0].code, "INVALID_FIELDS");
});

test("CLI rejects unknown, duplicate, and extra arguments", () => {
  const cases = [
    [["call", "get_issue", "--unknown"], /Unknown option for call/],
    [["call", "get_issue", "--dry-run", "--dry-run"], /specified only once/],
    [["call", "get_issue", "extra"], /Unexpected argument for call/],
    [["download", "download_issue_attachment"], /requires --output/],
    [["download", "download_issue_attachment", "--output", "-", "--unknown"], /Unknown option for download/],
    [["tools", "list", "extra"], /does not accept additional arguments/],
    [["tools", "describe"], /requires an operation name/],
    [["tools", "describe", "get_issue", "extra"], /does not accept additional arguments/],
    [["trace", "get_issue", "extra"], /at most one operation name/]
  ];

  for (const [args, expectedError] of cases) {
    const result = run(args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, expectedError);
  }

  const unknown = run(["tools", "describe", "not_an_operation"]);
  assert.equal(unknown.status, 2);
  assert.equal(unknown.stdout, "");
  assert.match(unknown.stderr, /Unknown operation/);
});

function run(args, input = "", extraEnv = {}) {
  const result = spawnSync("node", [CLI, ...args], {
    cwd: process.cwd(),
    input,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      ...extraEnv
    }
  });
  assert.equal(result.signal, null);
  return result;
}
