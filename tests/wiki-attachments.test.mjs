import assert from "node:assert/strict";
import test from "node:test";
import { createBacklogClientRegistry } from "../dist/ts/core/backlog-client-registry.js";
import { runOperation } from "../dist/ts/core/run-operation.js";
import { formatBacklogAccessEvent } from "../dist/ts/core/verbose-format.js";

test("get_wiki_attachments calls the Backlog Wiki attachment-list endpoint as READ", async () => {
  const attachments = [
    { id: 20, name: "diagram.png", size: 1536 }
  ];
  const requests = [];
  const events = [];
  const registry = createBacklogClientRegistry({
    env: {
      BACKLOG_ORG_ARCHIVE_DOMAIN: "archive.example.test",
      BACKLOG_ORG_ARCHIVE_API_KEY: "not-a-real-key",
      BACKLOG_DEFAULT_ORG: "ARCHIVE"
    },
    fetch: async (input, init) => {
      const url = input instanceof Request ? new URL(input.url) : new URL(input);
      requests.push({
        method: init?.method ?? (input instanceof Request ? input.method : "GET"),
        pathname: url.pathname
      });
      return Response.json(attachments);
    }
  });

  const result = await runOperation("get_wiki_attachments", {
    organization: "ARCHIVE",
    wikiId: 12345
  }, {
    registry,
    env: {},
    onAccess(event) {
      events.push(event);
    }
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.result, attachments);
  assert.deepEqual(requests, [{
    method: "GET",
    pathname: "/api/v2/wikis/12345/attachments"
  }]);
  assert.equal(result.toolset, "miku-backlog-api");
  assert.equal(result.trace.origin, "miku-backlog-api");
  assert.equal(result.trace.source, "src/core/local-tools.ts");
  assert.equal(result.trace.test, "tests/wiki-attachments.test.mjs");
  assert.deepEqual(events.map((event) => event.phase), ["start", "success"]);
  assert.equal(events[0].method, "getWikisAttachments");
  assert.equal(events[0].permission, "READ");
  assert.deepEqual(events[0].target, { wikiId: 12345 });
  assert.doesNotMatch(events.map(formatBacklogAccessEvent).join("\n"), /diagram\.png/);
});

test("get_wiki_attachments validates a positive Wiki ID and dry-run makes no request", async () => {
  let resolutions = 0;
  const registry = {
    resolveClient() {
      resolutions += 1;
      throw new Error("must not resolve during dry-run");
    },
    listOrganizations() {
      return [];
    }
  };

  const dryRun = await runOperation("get_wiki_attachments", { wikiId: 12345 }, {
    dryRun: true,
    registry,
    env: {}
  });
  assert.equal(dryRun.success, true);
  assert.equal(dryRun.dryRun, true);
  assert.equal(resolutions, 0);

  const invalid = await runOperation("get_wiki_attachments", { wikiId: 0 }, {
    dryRun: true,
    registry,
    env: {}
  });
  assert.equal(invalid.success, false);
  assert.equal(invalid.diagnostics[0].code, "INVALID_ARGUMENT");
  assert.equal(invalid.diagnostics[0].path, "wikiId");
  assert.equal(resolutions, 0);
});
