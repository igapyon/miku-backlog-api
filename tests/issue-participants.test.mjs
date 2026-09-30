import assert from "node:assert/strict";
import test from "node:test";
import { runOperation } from "../dist/ts/core/run-operation.js";
import { formatBacklogAccessEvent } from "../dist/ts/core/verbose-format.js";

const participants = [
  {
    id: 1,
    userId: "owner",
    name: "担当者",
    roleType: 2,
    lang: "ja",
    mailAddress: "owner@example.test",
    lastLoginTime: "2026-09-07T00:00:00Z"
  },
  {
    id: 2,
    userId: "reviewer",
    name: "確認者",
    roleType: 3,
    lang: "en",
    mailAddress: "reviewer@example.test",
    lastLoginTime: "2026-09-06T00:00:00Z"
  }
];

test("get_issue_participants returns a selected participant list for a named organization", async () => {
  const calls = [];
  const events = [];
  const result = await runOperation("get_issue_participants", {
    organization: "ARCHIVE",
    issueId: 10,
    fields: "{ id userId name }"
  }, {
    registry: {
      resolveClient(organization) {
        assert.equal(organization, "ARCHIVE");
        return {
          async getIssueParticipants(issueIdOrKey) {
            calls.push(issueIdOrKey);
            return structuredClone(participants);
          }
        };
      },
      listOrganizations() {
        return [];
      }
    },
    onAccess(event) {
      events.push(event);
    }
  });

  assert.equal(result.success, true);
  assert.deepEqual(calls, [10]);
  assert.deepEqual(result.result, [
    { id: 1, userId: "owner", name: "担当者" },
    { id: 2, userId: "reviewer", name: "確認者" }
  ]);
  assert.equal(result.toolset, "miku-backlog-api");
  assert.equal(result.trace.origin, "miku-backlog-api");
  assert.equal(result.trace.source, "src/core/local-tools.ts");
  assert.equal(result.trace.test, "tests/issue-participants.test.mjs");
  assert.deepEqual(events.map((event) => event.phase), ["start", "success"]);
  assert.deepEqual(events[0].target, { issueId: 10 });
  const verbose = events.map(formatBacklogAccessEvent).join("\n");
  assert.doesNotMatch(verbose, /owner@example|reviewer@example|担当者|確認者/);
});

test("get_issue_participants follows existing issue ID/key fallback and dry-run validation", async () => {
  const calls = [];
  const fallback = await runOperation("get_issue_participants", {
    issueId: 0,
    issueKey: "PROJ-2"
  }, {
    registry: {
      resolveClient() {
        return {
          async getIssueParticipants(issueIdOrKey) {
            calls.push(issueIdOrKey);
            return [];
          }
        };
      },
      listOrganizations() {
        return [];
      }
    }
  });
  assert.equal(fallback.success, true);
  assert.deepEqual(calls, ["PROJ-2"]);

  const invalid = await runOperation("get_issue_participants", {}, {
    dryRun: true,
    registry: {
      resolveClient() {
        throw new Error("must not resolve");
      },
      listOrganizations() {
        return [];
      }
    }
  });
  assert.equal(invalid.success, false);
  assert.equal(invalid.diagnostics[0].code, "INVALID_ARGUMENT");
  assert.equal(invalid.diagnostics[0].path, "issueId|issueKey");
});

test("get_issue_participants returns a sanitized upstream failure", async () => {
  const events = [];
  const result = await runOperation("get_issue_participants", {
    issueKey: "PROJ-3"
  }, {
    registry: {
      resolveClient() {
        return {
          async getIssueParticipants() {
            const error = new Error("participant details must not be logged");
            error.response = { status: 429 };
            throw error;
          }
        };
      },
      listOrganizations() {
        return [];
      }
    },
    onAccess(event) {
      events.push(event);
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.diagnostics[0].code, "UPSTREAM_ERROR");
  assert.deepEqual(events.map((event) => event.phase), ["start", "failure"]);
  assert.deepEqual(events[0].target, { issueKey: "PROJ-3" });
  assert.equal(events[1].httpStatus, 429);
  assert.doesNotMatch(
    events.map(formatBacklogAccessEvent).join("\n"),
    /participant details/
  );
});
