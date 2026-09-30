import assert from "node:assert/strict";
import test from "node:test";
import {
  createBacklogCapturingFetch,
  extractBacklogResponseMetadata
} from "../dist/ts/core/backlog-access-context.js";
import {
  environmentAllowedPermissions,
  parseCrudPermissions
} from "../dist/ts/core/access-permissions.js";
import { runOperation } from "../dist/ts/core/run-operation.js";
import { observeBacklogClient } from "../dist/ts/core/verbose-client.js";

test("environment CRUD permissions default, normalize, and reject malformed values", () => {
  assert.deepEqual(environmentAllowedPermissions({}), ["READ"]);
  assert.deepEqual(
    environmentAllowedPermissions({
      BACKLOG_API_ALLOWED_PERMISSIONS: " read , CREATE,\tupdate,read "
    }),
    ["READ", "CREATE", "UPDATE"]
  );
  for (const value of ["", "READ,,CREATE", "READ CREATE", "READ,WRITE"]) {
    assert.throws(
      () => environmentAllowedPermissions({ BACKLOG_API_ALLOWED_PERMISSIONS: value }),
      /BACKLOG_API_ALLOWED_PERMISSIONS/
    );
  }
});

test("environment and call-level permissions share one parser", () => {
  assert.deepEqual(parseCrudPermissions(" read , CREATE,read "), ["READ", "CREATE"]);
  for (const value of ["", "READ,,CREATE", "READ CREATE", "READ,WRITE"]) {
    assert.throws(() => parseCrudPermissions(value), /empty or unsupported/);
  }
});

test("environment permissions are enforced before call permissions and client resolution", async () => {
  const registry = {
    resolveClient() {
      throw new Error("must not resolve");
    }
  };
  const environmentDenied = await runOperation("add_issue", {}, {
    registry,
    env: {},
    allowedPermissions: ["CREATE"]
  });
  assert.equal(environmentDenied.success, false);
  assert.equal(environmentDenied.diagnostics[0].code, "ACCESS_PERMISSION_REQUIRED");

  const callDenied = await runOperation("add_issue", {}, {
    registry,
    env: { BACKLOG_API_ALLOWED_PERMISSIONS: "CREATE" }
  });
  assert.equal(callDenied.success, false);
  assert.equal(callDenied.diagnostics[0].code, "PERMISSION_REQUIRED");

  const invalidEnvironment = await runOperation("get_issue", {}, {
    registry,
    env: { BACKLOG_API_ALLOWED_PERMISSIONS: "READ,,CREATE" }
  });
  assert.equal(invalidEnvironment.success, false);
  assert.equal(invalidEnvironment.diagnostics[0].code, "CONFIGURATION_ERROR");
});

test("get_rate_limit is a local READ operation", async () => {
  const expected = {
    rateLimit: {
      read: { limit: 600, remaining: 599, reset: 1_760_000_000 },
      update: { limit: 150, remaining: 149, reset: 1_760_000_000 },
      search: { limit: 150, remaining: 148, reset: 1_760_000_000 },
      icon: { limit: 60, remaining: 59, reset: 1_760_000_000 }
    }
  };
  const result = await runOperation("get_rate_limit", {}, {
    env: {},
    registry: {
      resolveClient() {
        return {
          async getRateLimit() {
            return structuredClone(expected);
          }
        };
      }
    }
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.result, expected);
  assert.equal(result.toolset, "miku-backlog-api");
  assert.equal(result.trace.origin, "miku-backlog-api");
  assert.equal(result.trace.source, "src/core/local-tools.ts");
});

test("get_project_statuses is a local READ operation with project ID/key resolution", async () => {
  const statuses = [
    { id: 1, projectId: 10, name: "未対応", color: "#ed8077", displayOrder: 1000 },
    { id: 9, projectId: 10, name: "独自確認", color: "#3b9dbd", displayOrder: 4000 },
    { id: 4, projectId: 10, name: "完了", color: "#393939", displayOrder: 5000 }
  ];
  const calls = [];
  const events = [];
  const result = await runOperation("get_project_statuses", {
    organization: "TEST",
    projectId: 10,
    fields: "{ id name displayOrder }"
  }, {
    registry: {
      resolveClient(organization) {
        assert.equal(organization, "TEST");
        return {
          async getProjectStatuses(projectIdOrKey) {
            calls.push(projectIdOrKey);
            return structuredClone(statuses);
          }
        };
      }
    },
    onAccess(event) {
      events.push(event);
    }
  });

  assert.equal(result.success, true);
  assert.deepEqual(calls, [10]);
  assert.deepEqual(result.result, [
    { id: 1, name: "未対応", displayOrder: 1000 },
    { id: 9, name: "独自確認", displayOrder: 4000 },
    { id: 4, name: "完了", displayOrder: 5000 }
  ]);
  assert.equal(result.toolset, "miku-backlog-api");
  assert.equal(result.trace.origin, "miku-backlog-api");
  assert.equal(result.trace.source, "src/core/local-tools.ts");
  assert.deepEqual(events.map((event) => event.phase), ["start", "success"]);
  assert.deepEqual(events[0].target, { projectId: 10 });
  assert.equal(events[0].permission, "READ");

  const fallbackCalls = [];
  const fallback = await runOperation("get_project_statuses", {
    projectId: 0,
    projectKey: "PROJ"
  }, {
    registry: {
      resolveClient() {
        return {
          async getProjectStatuses(projectIdOrKey) {
            fallbackCalls.push(projectIdOrKey);
            return [];
          }
        };
      }
    }
  });
  assert.equal(fallback.success, true);
  assert.deepEqual(fallbackCalls, ["PROJ"]);
});

test("get_project_statuses validates a project identifier before resolving a client", async () => {
  const result = await runOperation("get_project_statuses", {}, {
    registry: {
      resolveClient() {
        throw new Error("must not resolve");
      }
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.diagnostics[0].code, "INVALID_ARGUMENT");
  assert.equal(result.diagnostics[0].path, "projectId|projectKey");
});

test("list_organizations exposes validated configuration without Backlog API access", async () => {
  const events = [];
  const single = await runOperation("list_organizations", {
    fields: "{ name isDefault }"
  }, {
    env: {
      BACKLOG_DOMAIN: "single.example.test",
      BACKLOG_API_KEY: "TOP_SECRET"
    },
    onAccess(event) {
      events.push(event);
    }
  });

  assert.equal(single.success, true);
  assert.deepEqual(single.result, [{ name: "default", isDefault: true }]);
  assert.equal(single.toolset, "miku-backlog-api");
  assert.equal(single.trace.origin, "miku-backlog-api");
  assert.deepEqual(events, []);
  assert.doesNotMatch(JSON.stringify(single), /TOP_SECRET/);

  const multi = await runOperation("list_organizations", {}, {
    env: {
      BACKLOG_ORG_ZETA_DOMAIN: "zeta.example.test",
      BACKLOG_ORG_ZETA_API_KEY: "ZETA_SECRET",
      BACKLOG_ORG_ALPHA_DOMAIN: "alpha.example.test",
      BACKLOG_ORG_ALPHA_API_KEY: "ALPHA_SECRET",
      BACKLOG_DEFAULT_ORG: "ZETA"
    }
  });
  assert.equal(multi.success, true);
  assert.deepEqual(multi.result, [
    { name: "ALPHA", domain: "alpha.example.test", isDefault: false },
    { name: "ZETA", domain: "zeta.example.test", isDefault: true }
  ]);
  assert.doesNotMatch(JSON.stringify(multi), /SECRET/);
});

test("list_organizations rejects invalid selection and configuration safely", async () => {
  const dryRun = await runOperation("list_organizations", {}, { dryRun: true });
  assert.equal(dryRun.success, true);
  assert.equal(dryRun.dryRun, true);

  const selection = await runOperation("list_organizations", {
    organization: "ALPHA"
  }, {
    env: {
      BACKLOG_DOMAIN: "single.example.test",
      BACKLOG_API_KEY: "TOP_SECRET"
    }
  });
  assert.equal(selection.success, false);
  assert.equal(selection.diagnostics[0].code, "INVALID_ARGUMENT");
  assert.doesNotMatch(JSON.stringify(selection), /TOP_SECRET/);

  const incomplete = await runOperation("list_organizations", {}, {
    env: {
      BACKLOG_ORG_ALPHA_DOMAIN: "alpha.example.test",
      BACKLOG_DEFAULT_ORG: "ALPHA"
    }
  });
  assert.equal(incomplete.success, false);
  assert.equal(incomplete.diagnostics[0].code, "CONFIGURATION_ERROR");
});

test("response metadata accepts only valid whitelisted rate-limit headers", () => {
  const valid = extractBacklogResponseMetadata(new Response(null, {
    status: 200,
    headers: {
      "X-RateLimit-Limit": "600",
      "X-RateLimit-Remaining": "599",
      "X-RateLimit-Reset": "1760000000",
      "X-Secret": "must-not-appear"
    }
  }));
  assert.deepEqual(valid, {
    httpStatus: 200,
    rateLimit: {
      limit: 600,
      remaining: 599,
      resetAt: new Date(1_760_000_000 * 1000).toISOString()
    }
  });
  assert.doesNotMatch(JSON.stringify(valid), /Secret|must-not-appear/);

  const invalid = extractBacklogResponseMetadata(new Response(null, {
    status: 429,
    headers: {
      "X-RateLimit-Limit": "-1",
      "X-RateLimit-Remaining": "not-a-number",
      "X-RateLimit-Reset": "Infinity"
    }
  }));
  assert.deepEqual(invalid, { httpStatus: 429 });
});

test("verbose events keep parallel response metadata isolated", async () => {
  const events = [];
  const fetch = createBacklogCapturingFetch(async (input) => {
    const id = Number(new URL(String(input)).searchParams.get("id"));
    await new Promise((resolve) => setTimeout(resolve, id === 1 ? 15 : 1));
    return new Response("{}", {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(id * 100),
        "X-RateLimit-Remaining": String(id * 100 - 1),
        "X-RateLimit-Reset": String(1_760_000_000 + id)
      }
    });
  });
  const client = observeBacklogClient(
    {
      async getIssue(id) {
        await fetch(`https://example.invalid/api/v2/issues/TEST-${id}?id=${id}`);
        return { id, issueKey: `TEST-${id}` };
      }
    },
    {
      operation: "get_issue",
      permission: "READ",
      organization: "default",
      input: {},
      onAccess(event) {
        events.push(event);
      }
    }
  );

  await Promise.all([client.getIssue(1), client.getIssue(2)]);
  const successes = events.filter((event) => event.phase === "success");
  assert.equal(successes.length, 2);
  const byIssue = new Map(successes.map((event) => [event.result.issueId, event]));
  assert.equal(byIssue.get(1).rateLimit.limit, 100);
  assert.equal(byIssue.get(2).rateLimit.limit, 200);
  assert.equal(byIssue.get(1).httpStatus, 200);
  assert.equal(byIssue.get(2).httpStatus, 200);
});

test("representative CRUD verbose events include captured response metadata", async (t) => {
  const fixtures = [
    ["READ", "get_issue", "getIssue", { issueKey: "TEST-1" }, {}],
    [
      "CREATE",
      "add_issue",
      "postIssue",
      { projectId: 1, summary: "x", issueTypeId: 2, priorityId: 3 },
      {}
    ],
    ["UPDATE", "update_issue", "patchIssue", { issueKey: "TEST-1", summary: "x" }, {}],
    ["DELETE", "delete_issue", "deleteIssue", { issueKey: "TEST-1" }, {
      confirmDestructive: true
    }]
  ];

  for (const [permission, operation, method, input, extraOptions] of fixtures) {
    await t.test(permission, async () => {
      const events = [];
      const fetch = createBacklogCapturingFetch(async () => new Response("{}", {
        status: 200,
        headers: {
          "X-RateLimit-Limit": "600",
          "X-RateLimit-Remaining": "599",
          "X-RateLimit-Reset": "1760000000"
        }
      }));
      const result = await runOperation(operation, input, {
        env: { BACKLOG_API_ALLOWED_PERMISSIONS: permission },
        allowedPermissions: [permission],
        ...extraOptions,
        registry: {
          resolveClient() {
            return {
              async [method]() {
                await fetch("https://example.invalid/api/v2/test");
                return operation.includes("issue")
                  ? { id: 1, issueKey: "TEST-1" }
                  : {};
              }
            };
          }
        },
        onAccess(event) {
          events.push(event);
        }
      });
      assert.equal(result.success, true);
      assert.equal(events[1].httpStatus, 200);
      assert.deepEqual(events[1].rateLimit, {
        limit: 600,
        remaining: 599,
        resetAt: new Date(1_760_000_000 * 1000).toISOString()
      });
    });
  }
});
