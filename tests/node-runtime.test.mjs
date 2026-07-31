import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  classifyMutation,
  describeOperation,
  listOperations,
  requiredPermission
} from "../dist/ts/core/catalog.js";
import { runOperation } from "../dist/ts/core/run-operation.js";
import { formatBacklogAccessEvent } from "../dist/ts/core/verbose-format.js";
import { observeBacklogClient } from "../dist/ts/core/verbose-client.js";

const ROOT = process.cwd();
const mapping = JSON.parse(
  fs.readFileSync(path.resolve(ROOT, "docs", "traceability", "upstream-tool-mapping.json"), "utf8")
);

test("all upstream operations have deterministic source and test mappings", () => {
  const runtimeNames = listOperations().map((entry) => entry.name);
  const mappedNames = mapping.operations.map((entry) => entry.operation);

  assert.equal(runtimeNames.length, 63);
  assert.deepEqual(mappedNames, runtimeNames);
  const upstreamEntries = mapping.operations.filter((entry) => entry.origin === "upstream");
  const localEntries = mapping.operations.filter((entry) => entry.origin === "backlog-api");
  assert.equal(upstreamEntries.length, 62);
  assert.deepEqual(localEntries.map((entry) => entry.operation), ["get_rate_limit"]);
  assert.equal(localEntries[0].upstreamSource, null);
  assert.equal(localEntries[0].targetEntry, "src/core/local-tools.ts");
  for (const entry of upstreamEntries) {
    assert.match(entry.upstreamSource, /^src\/tools\/.+\.ts$/);
    assert.match(entry.upstreamTest, /^src\/tools\/.+\.test\.ts$/);
    assert.equal(entry.targetEntry, "src/core/run-operation.ts");
  }
});

test("generated Node runtime excludes upstream MCP and HTTP server modules", () => {
  const meta = JSON.parse(
    fs.readFileSync(path.resolve(ROOT, "bundle", "backlog-api-meta.json"), "utf8")
  );
  const inputs = Object.keys(meta.inputs);

  assert.equal(inputs.some((entry) => entry.includes("@modelcontextprotocol")), false);
  assert.equal(inputs.some((entry) => entry.includes("@hono/")), false);
  assert.equal(inputs.some((entry) => entry.includes("httpMcpServer")), false);
});

test("all operations expose machine-readable agent contracts", () => {
  for (const catalogEntry of listOperations()) {
    const description = describeOperation(catalogEntry.name);
    assert.notEqual(description, undefined);
    assert.equal(description.name, catalogEntry.name);
    assert.equal(description.requiredPermission, catalogEntry.requiredPermission);
    assert.equal(description.inputSchema.type, "object");
    assert.equal(description.inputSchema.properties.organization.type, "string");
    assert.equal(description.inputSchema.properties.fields.type, "string");
    assert.equal(description.credentialsRequiredForDryRun, false);
    assert.equal(typeof description.outputFieldSchema, "object");
  }
  assert.equal(describeOperation("not_an_operation"), undefined);
});

test("mutation classification preserves unusual upstream names", () => {
  assert.equal(classifyMutation("get_issue"), "read");
  assert.equal(classifyMutation("get_related_issues"), "read");
  assert.equal(classifyMutation("add_issue"), "mutation");
  assert.equal(classifyMutation("add_related_issue"), "mutation");
  assert.equal(classifyMutation("addDocument"), "mutation");
  assert.equal(classifyMutation("update_issue_comment"), "mutation");
  assert.equal(classifyMutation("delete_project"), "destructive");
  assert.equal(classifyMutation("remove_related_issue"), "destructive");
  assert.equal(classifyMutation("reset_unread_notification_count"), "broad-mutation");
  assert.equal(requiredPermission("get_issue"), "READ");
  assert.equal(requiredPermission("get_related_issues"), "READ");
  assert.equal(requiredPermission("addDocument"), "CREATE");
  assert.equal(requiredPermission("add_related_issue"), "CREATE");
  assert.equal(requiredPermission("mark_notification_as_read"), "UPDATE");
  assert.equal(requiredPermission("update_issue_comment"), "UPDATE");
  assert.equal(requiredPermission("reset_unread_notification_count"), "UPDATE");
  assert.equal(requiredPermission("delete_project"), "DELETE");
  assert.equal(requiredPermission("remove_related_issue"), "DELETE");
  assert.throws(
    () => classifyMutation("archive_issue"),
    /has no declared access policy/
  );
});

test("unknown operations fail before permission configuration or client resolution", async () => {
  const result = await runOperation("archive_issue", {}, {
    env: { BACKLOG_API_ALLOWED_PERMISSIONS: "READ,,UPDATE" },
    registry: {
      resolveClient() {
        throw new Error("must not resolve");
      }
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.diagnostics[0].code, "UNKNOWN_OPERATION");
});

test("permission policy rejects operations before client resolution", async () => {
  const registry = {
    resolveClient() {
      throw new Error("must not resolve");
    }
  };
  const result = await runOperation("update_issue", {}, {
    registry,
    env: { BACKLOG_API_ALLOWED_PERMISSIONS: "UPDATE" },
    allowedPermissions: ["READ"]
  });

  assert.equal(result.success, false);
  assert.equal(result.diagnostics[0].code, "PERMISSION_REQUIRED");
});

test("get_issue validates and invokes the original upstream handler", async () => {
  const calls = [];
  const accessEvents = [];
  const backlog = {
    async getIssue(value) {
      calls.push(value);
      return { id: 123, issueKey: value, summary: "fixture" };
    }
  };
  const registry = {
    resolveClient(organization) {
      assert.equal(organization, "TEST");
      return backlog;
    }
  };

  const result = await runOperation(
    "get_issue",
    { organization: "TEST", issueKey: "TEST-1" },
    {
      registry,
      onAccess(event) {
        accessEvents.push(event);
      }
    }
  );

  assert.equal(result.success, true);
  assert.deepEqual(calls, ["TEST-1"]);
  assert.equal(result.result.issueKey, "TEST-1");
  assert.equal(result.trace.source, "src/tools/getIssue.ts");
  assert.deepEqual(accessEvents.map((event) => event.phase), ["start", "success"]);
  assert.equal(accessEvents[0].organization, "named");
});

test("verbose access events describe API calls without request or response data", async () => {
  const events = [];
  const client = observeBacklogClient(
    {
      async getIssue(issueKey) {
        assert.equal(issueKey, "SECRET-1");
        return { summary: "secret response" };
      }
    },
    {
      operation: "get_issue",
      permission: "READ",
      organization: "named",
      input: { issueKey: "VISIBLE-1", query: "secret query" },
      onAccess(event) {
        events.push(event);
      }
    }
  );

  await client.getIssue("SECRET-1");

  assert.deepEqual(events.map((event) => event.phase), ["start", "success"]);
  assert.deepEqual(events.map((event) => event.access), [1, 1]);
  const lines = events.map(formatBacklogAccessEvent).join("\n");
  assert.match(lines, /"operation":"get_issue"/);
  assert.match(lines, /"method":"getIssue"/);
  assert.match(lines, /"target":\{"issueKey":"VISIBLE-1"\}/);
  assert.doesNotMatch(lines, /SECRET-1|secret response|secret query/);
});

test("verbose access events report failures without leaking error details", async () => {
  const events = [];
  const client = observeBacklogClient(
    {
      async getIssue() {
        const error = new Error("secret upstream message");
        error.response = { status: 429, data: "secret response" };
        throw error;
      }
    },
    {
      operation: "get_issue",
      permission: "READ",
      organization: "default",
      input: { issueKey: "VISIBLE-2" },
      onAccess(event) {
        events.push(event);
      }
    }
  );

  await assert.rejects(client.getIssue("SECRET-2"), /secret upstream message/);
  assert.deepEqual(events.map((event) => event.phase), ["start", "failure"]);
  assert.equal(events[1].httpStatus, 429);
  assert.equal(typeof events[1].durationMs, "number");
  assert.doesNotMatch(
    events.map(formatBacklogAccessEvent).join("\n"),
    /SECRET-2|secret upstream|secret response/
  );
});

test("verbose metadata safely covers representative CRUD operations", async (t) => {
  const fixtures = [
    {
      name: "READ",
      operation: "get_issue",
      input: { issueKey: "SAFE-1" },
      options: {
        env: { BACKLOG_API_ALLOWED_PERMISSIONS: "READ" },
        allowedPermissions: ["READ"]
      },
      method: "getIssue",
      response: { id: 101, issueKey: "SAFE-1", summary: "SECRET READ RESULT" },
      target: { issueKey: "SAFE-1" },
      result: { issueId: 101, issueKey: "SAFE-1" }
    },
    {
      name: "CREATE",
      operation: "add_issue",
      input: {
        projectId: 10,
        summary: "SECRET CREATE SUMMARY",
        description: "SECRET CREATE DESCRIPTION",
        issueTypeId: 20,
        priorityId: 30
      },
      options: {
        env: { BACKLOG_API_ALLOWED_PERMISSIONS: "CREATE" },
        allowedPermissions: ["CREATE"]
      },
      method: "postIssue",
      response: { id: 102, issueKey: "SAFE-2", summary: "SECRET CREATE RESULT" },
      target: { projectId: 10 },
      result: { issueId: 102, issueKey: "SAFE-2" }
    },
    {
      name: "UPDATE",
      operation: "update_issue",
      input: {
        issueKey: "SAFE-3",
        summary: "SECRET UPDATE SUMMARY",
        comment: "SECRET UPDATE COMMENT",
        statusId: 4,
        secretUnknown: "SECRET UNKNOWN FIELD"
      },
      options: {
        env: { BACKLOG_API_ALLOWED_PERMISSIONS: "UPDATE" },
        allowedPermissions: ["UPDATE"]
      },
      method: "patchIssue",
      response: { id: 103, issueKey: "SAFE-3", summary: "SECRET UPDATE RESULT" },
      target: { issueKey: "SAFE-3" },
      result: { issueId: 103, issueKey: "SAFE-3" },
      changedFields: ["comment", "statusId", "summary"]
    },
    {
      name: "DELETE",
      operation: "delete_issue",
      input: { issueKey: "SAFE-4" },
      options: {
        env: { BACKLOG_API_ALLOWED_PERMISSIONS: "DELETE" },
        allowedPermissions: ["DELETE"],
        confirmDestructive: true
      },
      method: "deleteIssue",
      response: { id: 104, issueKey: "SAFE-4", summary: "SECRET DELETE RESULT" },
      target: { issueKey: "SAFE-4" },
      result: { issueId: 104, issueKey: "SAFE-4" }
    }
  ];

  for (const fixture of fixtures) {
    await t.test(fixture.name, async () => {
      const events = [];
      const registry = {
        resolveClient() {
          return {
            async [fixture.method]() {
              return structuredClone(fixture.response);
            }
          };
        }
      };
      const operationResult = await runOperation(fixture.operation, fixture.input, {
        ...fixture.options,
        registry,
        onAccess(event) {
          events.push(event);
        }
      });

      assert.equal(operationResult.success, true);
      assert.deepEqual(events.map((event) => event.phase), ["start", "success"]);
      assert.deepEqual(events[0].target, fixture.target);
      assert.deepEqual(events[1].result, fixture.result);
      assert.deepEqual(events[0].changedFields, fixture.changedFields);
      assert.equal(typeof events[1].durationMs, "number");

      const lines = events.map(formatBacklogAccessEvent).join("\n");
      assert.doesNotMatch(lines, /SECRET|description|secretUnknown|"statusId":4/);
      for (const line of lines.split("\n")) {
        const body = JSON.parse(line.slice("verbose: ".length));
        assert.equal(body.type, "backlog-api-access");
      }
    });
  }
});

test("verbose metadata includes pagination and ID filters but omits search text", async () => {
  const events = [];
  const result = await runOperation(
    "get_issues",
    {
      projectId: [10, 11],
      keyword: "SECRET SEARCH KEYWORD",
      offset: 20,
      count: 5
    },
    {
      allowedPermissions: ["READ"],
      registry: {
        resolveClient() {
          return {
            async getIssues() {
              return [];
            }
          };
        }
      },
      onAccess(event) {
        events.push(event);
      }
    }
  );

  assert.equal(result.success, true);
  assert.deepEqual(events[0].target, { projectId: [10, 11] });
  assert.deepEqual(events[0].pagination, { offset: 20, count: 5 });
  assert.doesNotMatch(events.map(formatBacklogAccessEvent).join("\n"), /SECRET|keyword/);
});

test("related-issue operations expose only whitelisted identifiers in verbose events", async () => {
  const events = [];
  const result = await runOperation(
    "add_related_issue",
    {
      issueKey: "SAFE-5",
      targetIssueId: 6,
      note: "SECRET RELATION NOTE"
    },
    {
      env: { BACKLOG_API_ALLOWED_PERMISSIONS: "CREATE" },
      allowedPermissions: ["CREATE"],
      registry: {
        resolveClient() {
          return {
            async addRelatedIssue() {
              return { id: 6, issueKey: "SAFE-6", summary: "SECRET RESULT" };
            }
          };
        }
      },
      onAccess(event) {
        events.push(event);
      }
    }
  );

  assert.equal(result.success, true);
  assert.deepEqual(events[0].target, { issueKey: "SAFE-5", targetIssueId: 6 });
  assert.deepEqual(events[1].result, { issueId: 6, issueKey: "SAFE-6" });
  assert.doesNotMatch(events.map(formatBacklogAccessEvent).join("\n"), /SECRET|note/);
});

test("fields selects top-level and nested result data", async () => {
  const registry = {
    resolveClient() {
      return {
        async getIssue() {
          return {
            id: 123,
            issueKey: "TEST-1",
            summary: "fixture",
            createdUser: { id: 9, name: "User", mailAddress: "hidden@example.com" }
          };
        }
      };
    }
  };
  const result = await runOperation(
    "get_issue",
    {
      issueKey: "TEST-1",
      fields: "{ id summary createdUser { name } }"
    },
    { registry, allowedPermissions: ["READ"] }
  );

  assert.equal(result.success, true);
  assert.deepEqual(result.result, {
    id: 123,
    summary: "fixture",
    createdUser: { name: "User" }
  });
});

test("invalid fields prevents a mutation before client resolution", async () => {
  const registry = {
    resolveClient() {
      throw new Error("must not resolve");
    }
  };
  const result = await runOperation(
    "add_issue",
    {
      projectId: 10,
      summary: "must not be created",
      issueTypeId: 20,
      priorityId: 30,
      fields: "id summary"
    },
    {
      registry,
      env: { BACKLOG_API_ALLOWED_PERMISSIONS: "CREATE" },
      allowedPermissions: ["CREATE"]
    }
  );

  assert.equal(result.success, false);
  assert.equal(result.diagnostics[0].code, "INVALID_FIELDS");
});

test("required input schema errors return diagnostics without invoking Backlog", async () => {
  const registry = {
    resolveClient() {
      return {};
    }
  };
  const result = await runOperation("add_issue", {}, {
    registry,
    env: { BACKLOG_API_ALLOWED_PERMISSIONS: "CREATE" },
    allowedPermissions: ["CREATE"]
  });

  assert.equal(result.success, false);
  assert.equal(result.diagnostics[0].code, "INVALID_ARGUMENT");
});

test("destructive operations require confirmation before client resolution", async () => {
  const registry = {
    resolveClient() {
      throw new Error("must not resolve");
    }
  };
  const result = await runOperation("delete_issue", { issueKey: "TEST-1" }, {
    registry,
    env: { BACKLOG_API_ALLOWED_PERMISSIONS: "DELETE" },
    allowedPermissions: ["DELETE"]
  });

  assert.equal(result.success, false);
  assert.equal(result.diagnostics[0].code, "CONFIRMATION_REQUIRED");

  const removeRelated = await runOperation(
    "remove_related_issue",
    { issueKey: "TEST-1", relatedIssueId: 12345 },
    {
      registry,
      env: { BACKLOG_API_ALLOWED_PERMISSIONS: "DELETE" },
      allowedPermissions: ["DELETE"]
    }
  );

  assert.equal(removeRelated.success, false);
  assert.equal(removeRelated.diagnostics[0].code, "CONFIRMATION_REQUIRED");
});
