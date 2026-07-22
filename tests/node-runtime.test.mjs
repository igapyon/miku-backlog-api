import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  classifyMutation,
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

  assert.equal(runtimeNames.length, 58);
  assert.deepEqual(mappedNames, runtimeNames);
  for (const entry of mapping.operations) {
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

test("mutation classification preserves unusual upstream names", () => {
  assert.equal(classifyMutation("get_issue"), "read");
  assert.equal(classifyMutation("add_issue"), "mutation");
  assert.equal(classifyMutation("addDocument"), "mutation");
  assert.equal(classifyMutation("delete_project"), "destructive");
  assert.equal(classifyMutation("reset_unread_notification_count"), "broad-mutation");
  assert.equal(requiredPermission("get_issue"), "READ");
  assert.equal(requiredPermission("addDocument"), "CREATE");
  assert.equal(requiredPermission("mark_notification_as_read"), "UPDATE");
  assert.equal(requiredPermission("reset_unread_notification_count"), "UPDATE");
  assert.equal(requiredPermission("delete_project"), "DELETE");
});

test("permission policy rejects operations before client resolution", async () => {
  const registry = {
    resolveClient() {
      throw new Error("must not resolve");
    }
  };
  const result = await runOperation("update_issue", {}, {
    registry,
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
      onAccess(event) {
        events.push(event);
      }
    }
  );

  await client.getIssue("SECRET-1");

  assert.deepEqual(events.map((event) => event.phase), ["start", "success"]);
  assert.deepEqual(events.map((event) => event.access), [1, 1]);
  const lines = events.map(formatBacklogAccessEvent).join("\n");
  assert.match(lines, /operation=get_issue method=getIssue permission=READ organization=named/);
  assert.doesNotMatch(lines, /SECRET-1|secret response/);
});

test("verbose access events report failures without leaking error details", async () => {
  const events = [];
  const client = observeBacklogClient(
    {
      async getIssue() {
        throw new Error("secret upstream message");
      }
    },
    {
      operation: "get_issue",
      permission: "READ",
      organization: "default",
      onAccess(event) {
        events.push(event);
      }
    }
  );

  await assert.rejects(client.getIssue("SECRET-2"), /secret upstream message/);
  assert.deepEqual(events.map((event) => event.phase), ["start", "failure"]);
  assert.doesNotMatch(events.map(formatBacklogAccessEvent).join("\n"), /SECRET-2|secret upstream/);
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
    { registry, allowedPermissions: ["CREATE"] }
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
  const result = await runOperation("add_issue", {}, { registry });

  assert.equal(result.success, false);
  assert.equal(result.diagnostics[0].code, "INVALID_ARGUMENT");
});

test("destructive operations require confirmation before client resolution", async () => {
  const registry = {
    resolveClient() {
      throw new Error("must not resolve");
    }
  };
  const result = await runOperation("delete_issue", { issueKey: "TEST-1" }, { registry });

  assert.equal(result.success, false);
  assert.equal(result.diagnostics[0].code, "CONFIRMATION_REQUIRED");
});
