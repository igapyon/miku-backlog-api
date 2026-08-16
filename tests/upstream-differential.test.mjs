import assert from "node:assert/strict";
import test from "node:test";
import { allTools, backlogErrorHandler, composeToolHandler } from "backlog-mcp-server";
import { runOperation } from "../dist/ts/core/run-operation.js";

const translation = {
  t(_key, fallback) {
    return fallback;
  },
  dump() {
    return {};
  }
};

const cases = [
  {
    operation: "get_issue",
    permission: "READ",
    method: "getIssue",
    input: { organization: "TEST", issueKey: "TEST-1" },
    response: { id: 1, issueKey: "TEST-1", summary: "read fixture" }
  },
  {
    operation: "add_issue",
    permission: "CREATE",
    method: "postIssue",
    input: {
      organization: "TEST",
      projectId: 10,
      summary: "create fixture",
      issueTypeId: 20,
      priorityId: 30,
      description: "created by differential test",
      customFields: [{ id: 40, value: "custom value" }]
    },
    response: { id: 2, issueKey: "TEST-2", summary: "create fixture" }
  },
  {
    operation: "update_issue",
    permission: "UPDATE",
    method: "patchIssue",
    input: {
      organization: "TEST",
      issueKey: "TEST-3",
      summary: "updated fixture",
      parentIssueId: 99,
      customFields: [{ id: 41, value: ["one", "two"] }]
    },
    response: { id: 3, issueKey: "TEST-3", summary: "updated fixture" }
  },
  {
    operation: "delete_issue",
    permission: "DELETE",
    method: "deleteIssue",
    input: { organization: "TEST", issueKey: "TEST-4" },
    response: { id: 4, issueKey: "TEST-4", summary: "deleted fixture" }
  },
  {
    operation: "get_related_issues",
    permission: "READ",
    method: "getRelatedIssues",
    input: { organization: "TEST", issueKey: "TEST-5" },
    response: [{ id: 5, issueKey: "TEST-6", summary: "related fixture", type: "Relates" }]
  },
  {
    operation: "add_related_issue",
    permission: "CREATE",
    method: "addRelatedIssue",
    input: { organization: "TEST", issueKey: "TEST-7", targetIssueId: 8 },
    response: { id: 7, issueKey: "TEST-7", summary: "added relation", type: "Relates" }
  },
  {
    operation: "update_issue_comment",
    permission: "UPDATE",
    method: "patchIssueComment",
    input: {
      organization: "TEST",
      issueKey: "TEST-8",
      commentId: 9,
      content: "updated comment fixture"
    },
    response: { id: 9, content: "updated comment fixture" }
  },
  {
    operation: "remove_related_issue",
    permission: "DELETE",
    method: "removeRelatedIssue",
    input: { organization: "TEST", issueKey: "TEST-9", relatedIssueId: 10 },
    response: { id: 9, issueKey: "TEST-9", summary: "removed relation", type: "Relates" }
  }
];

test("representative CRUD operations match upstream composed MCP handlers", async (t) => {
  for (const fixture of cases) {
    await t.test(fixture.operation, async () => {
      const upstreamCalls = [];
      const nodeCalls = [];
      const upstreamBacklog = mockBacklog(
        fixture.method,
        fixture.response,
        upstreamCalls
      );
      const nodeBacklog = mockBacklog(fixture.method, fixture.response, nodeCalls);

      const upstreamHandler = composeToolHandler(upstreamTool(fixture.operation, upstreamBacklog), {
        useFields: false,
        errorHandler: backlogErrorHandler,
        maxTokens: 100_000
      });
      const upstreamResult = await upstreamHandler.handler(fixture.input);

      let resolvedOrganization;
      const nodeResult = await runOperation(fixture.operation, fixture.input, {
        registry: {
          resolveClient(organization) {
            resolvedOrganization = organization;
            return nodeBacklog;
          }
        },
        env: { BACKLOG_API_ALLOWED_PERMISSIONS: fixture.permission },
        allowedPermissions: [fixture.permission],
        confirmDestructive: fixture.permission === "DELETE"
      });

      assert.equal(nodeResult.success, true);
      assert.equal(resolvedOrganization, "TEST");
      assert.deepEqual(nodeResult.result, mcpData(upstreamResult));
      assert.deepEqual(nodeCalls, upstreamCalls);
    });
  }
});

test("Node preserves GraphQL-style fields while v0.18.0 uses list-only field arrays", async () => {
  const response = {
    id: 6,
    issueKey: "TEST-6",
    summary: "fields fixture",
    createdUser: { id: 9, name: "User", mailAddress: "hidden@example.com" }
  };
  const input = {
    organization: "TEST",
    issueKey: "TEST-6",
    fields: "{ id summary createdUser { name } }"
  };
  const upstreamHandler = composeToolHandler(upstreamTool("get_issue", mockBacklog("getIssue", response, [])), {
    useFields: true,
    errorHandler: backlogErrorHandler,
    maxTokens: 100_000
  });
  const nodeResult = await runOperation("get_issue", input, {
    registry: {
      resolveClient() {
        return mockBacklog("getIssue", response, []);
      }
    },
    allowedPermissions: ["READ"]
  });

  assert.equal(nodeResult.success, true);
  assert.equal(upstreamHandler.schema.shape.fields, undefined);
  assert.deepEqual(nodeResult.result, {
    id: 6,
    summary: "fields fixture",
    createdUser: { name: "User" }
  });
});

test("non-positive issue IDs fall back to issueKey in both wrappers", async () => {
  const input = { organization: "TEST", issueId: 0, issueKey: "TEST-10" };
  const upstreamCalls = [];
  const nodeCalls = [];
  const upstreamHandler = composeToolHandler(upstreamTool("get_issue", mockBacklog("getIssue", {
    id: 10,
    issueKey: "TEST-10",
    summary: "fallback fixture"
  }, upstreamCalls)), {
    useFields: false,
    errorHandler: backlogErrorHandler,
    maxTokens: 100_000
  });
  const upstreamResult = await upstreamHandler.handler(input);
  const nodeResult = await runOperation("get_issue", input, {
    registry: {
      resolveClient() {
        return mockBacklog("getIssue", {
          id: 10,
          issueKey: "TEST-10",
          summary: "fallback fixture"
        }, nodeCalls);
      }
    },
    allowedPermissions: ["READ"]
  });

  assert.equal(nodeResult.success, true);
  assert.deepEqual(nodeResult.result, mcpData(upstreamResult));
  assert.deepEqual(upstreamCalls, [{ method: "getIssue", args: ["TEST-10"] }]);
  assert.deepEqual(nodeCalls, upstreamCalls);
});

test("upstream and Node wrappers preserve the same Backlog error message", async () => {
  const message = "fixture Backlog failure";
  const upstreamHandler = composeToolHandler(upstreamTool("get_issue", failingBacklog("getIssue", message)), {
    useFields: false,
    errorHandler: backlogErrorHandler,
    maxTokens: 100_000
  });
  const input = { organization: "TEST", issueKey: "TEST-5" };
  const upstreamResult = await upstreamHandler.handler(input);
  const nodeResult = await runOperation("get_issue", input, {
    registry: {
      resolveClient() {
        return failingBacklog("getIssue", message);
      }
    },
    allowedPermissions: ["READ"]
  });

  assert.equal(upstreamResult.isError, true);
  assert.equal(nodeResult.success, false);
  assert.equal(nodeResult.diagnostics[0].code, "UPSTREAM_ERROR");
  assert.equal(nodeResult.diagnostics[0].message, upstreamResult.content[0].text);
});

function mockBacklog(method, response, calls) {
  return {
    async [method](...args) {
      calls.push({ method, args });
      return structuredClone(response);
    }
  };
}

function failingBacklog(method, message) {
  return {
    async [method]() {
      throw new Error(message);
    }
  };
}

function mcpData(result) {
  assert.equal(result.isError, undefined);
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, "text");
  return JSON.parse(result.content[0].text);
}

function upstreamTool(operation, backlog) {
  const tool = allTools(backlog, translation)
    .toolsets
    .flatMap((toolset) => toolset.tools)
    .find((candidate) => candidate.name === operation);
  assert.ok(tool, `missing upstream tool: ${operation}`);
  return tool;
}
