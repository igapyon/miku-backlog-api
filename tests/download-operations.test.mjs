import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBacklogCapturingFetch } from "../dist/ts/core/backlog-access-context.js";
import { openDownload } from "../dist/ts/core/download-operation.js";
import { writeDownloadToOutput } from "../dist/ts/core/download-output.js";
import { runOperation } from "../dist/ts/core/run-operation.js";

test("get_shared_files returns paged directory metadata through the normal JSON contract", async () => {
  const calls = [];
  const events = [];
  const result = await runOperation("get_shared_files", {
    organization: "ARCHIVE",
    projectKey: "PROJ",
    path: "/設計/",
    order: "asc",
    offset: 1,
    count: 2,
    fields: "{ id type name size }"
  }, {
    registry: {
      resolveClient(organization) {
        assert.equal(organization, "ARCHIVE");
        return {
          async getSharedFiles(projectIdOrKey, directoryPath, paging) {
            calls.push({ projectIdOrKey, directoryPath, paging });
            return [
              { id: 10, projectId: 1, type: "dir", dir: "/設計/", name: "議事録", size: 0 },
              { id: 11, projectId: 1, type: "file", dir: "/設計/", name: "仕様書.pdf", size: 42 }
            ];
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
  assert.deepEqual(calls, [{
    projectIdOrKey: "PROJ",
    directoryPath: "/設計/",
    paging: { order: "asc", offset: 1, count: 2 }
  }]);
  assert.deepEqual(result.result, [
    { id: 10, type: "dir", name: "議事録", size: 0 },
    { id: 11, type: "file", name: "仕様書.pdf", size: 42 }
  ]);
  assert.deepEqual(events.map((event) => event.phase), ["start", "success"]);
  assert.deepEqual(events[0].target, { projectKey: "PROJ" });
  assert.deepEqual(events[0].pagination, { offset: 1, count: 2 });
});

test("issue attachment downloads preserve streaming, selected organization, and response metadata", async () => {
  const events = [];
  const calls = [];
  const fetch = createBacklogCapturingFetch(async () => new Response("添付内容", {
    status: 200,
    headers: {
      "X-RateLimit-Limit": "600",
      "X-RateLimit-Remaining": "599",
      "X-RateLimit-Reset": "1760000000"
    }
  }));
  const result = await openDownload("download_issue_attachment", {
    organization: "ARCHIVE",
    issueKey: "PROJ-1",
    attachmentId: 20
  }, {
    registry: {
      resolveClient(organization) {
        assert.equal(organization, "ARCHIVE");
        return {
          async getIssueAttachment(issueIdOrKey, attachmentId) {
            calls.push({ issueIdOrKey, attachmentId });
            const response = await fetch("https://example.invalid/issue-attachment");
            return { body: response.body, filename: "仕様書.txt" };
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
  assert.deepEqual(calls, [{ issueIdOrKey: "PROJ-1", attachmentId: 20 }]);
  assert.equal(result.transfer.filename, "仕様書.txt");
  assert.equal(await readText(result.transfer.body), "添付内容");
  await result.transfer.completed;
  assert.deepEqual(events.map((event) => event.phase), ["start", "success"]);
  assert.deepEqual(events[0].target, { issueKey: "PROJ-1", attachmentId: 20 });
  assert.equal(events[1].httpStatus, 200);
  assert.deepEqual(events[1].rateLimit, {
    limit: 600,
    remaining: 599,
    resetAt: new Date(1_760_000_000 * 1000).toISOString()
  });
});

test("Wiki and shared-file downloads call their Backlog client methods", async () => {
  const calls = [];
  const registry = {
    resolveClient() {
      return {
        async getWikiAttachment(wikiId, attachmentId) {
          calls.push(["wiki", wikiId, attachmentId]);
          return downloadSource("wiki");
        },
        async getSharedFile(projectIdOrKey, sharedFileId) {
          calls.push(["shared", projectIdOrKey, sharedFileId]);
          return downloadSource("shared");
        }
      };
    },
    listOrganizations() {
      return [];
    }
  };

  const wiki = await openDownload("download_wiki_attachment", { wikiId: 30, attachmentId: 31 }, {
    registry
  });
  const shared = await openDownload("download_shared_file", {
    projectId: 32,
    sharedFileId: 33
  }, { registry });

  assert.equal(wiki.success, true);
  assert.equal(await readText(wiki.transfer.body), "wiki");
  await wiki.transfer.completed;
  assert.equal(shared.success, true);
  assert.equal(await readText(shared.transfer.body), "shared");
  await shared.transfer.completed;
  assert.deepEqual(calls, [["wiki", 30, 31], ["shared", 32, 33]]);
});

test("download dry-run does no I/O and normal call reports the dedicated binary diagnostic", async () => {
  const dryRun = await openDownload("download_shared_file", {
    projectKey: "PROJ",
    sharedFileId: 4
  }, {
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
  assert.equal(dryRun.success, true);
  assert.equal(dryRun.dryRun, true);

  const invalidIdentifier = await openDownload("download_shared_file", {
    projectId: 0,
    sharedFileId: 4
  }, { dryRun: true });
  assert.equal(invalidIdentifier.success, false);
  assert.equal(invalidIdentifier.diagnostics[0].code, "INVALID_ARGUMENT");
  assert.equal(invalidIdentifier.diagnostics[0].path, "projectId|projectKey");

  const normalCall = await runOperation("download_shared_file", {
    projectKey: "PROJ",
    sharedFileId: 4
  });
  assert.equal(normalCall.success, false);
  assert.equal(normalCall.diagnostics[0].code, "BINARY_OUTPUT_REQUIRED");
});

test("interrupted downloads emit a failure outcome after their stream is consumed", async () => {
  const events = [];
  const result = await openDownload("download_issue_attachment", {
    issueId: 40,
    attachmentId: 41
  }, {
    registry: {
      resolveClient() {
        return {
          async getIssueAttachment() {
            return { body: failingStream() };
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
  await assert.rejects(readText(result.transfer.body), /connection interrupted/);
  await assert.rejects(result.transfer.completed, /connection interrupted/);
  assert.deepEqual(events.map((event) => event.phase), ["start", "failure"]);
  assert.deepEqual(events[0].target, { issueId: 40, attachmentId: 41 });
});

test("file output is byte-exact, atomic, and never overwrites an existing file", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "miku-backlog-api-download-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const destination = path.join(directory, "attachment.bin");
  const transfer = {
    body: streamFromChunks([new Uint8Array([0, 1]), new Uint8Array([2, 255])]),
    completed: Promise.resolve()
  };

  await writeDownloadToOutput(transfer, destination);
  assert.deepEqual(fs.readFileSync(destination), Buffer.from([0, 1, 2, 255]));
  await assert.rejects(writeDownloadToOutput(transfer, destination), /Refusing to overwrite/);
  assert.equal(fs.readdirSync(directory).some((name) => name.endsWith(".part")), false);

  const failedDestination = path.join(directory, "failed.bin");
  const failure = new Error("write interrupted");
  const completed = Promise.reject(failure);
  void completed.catch(() => {});
  await assert.rejects(writeDownloadToOutput({
    body: failingStream(),
    completed
  }, failedDestination), /connection interrupted/);
  assert.equal(fs.existsSync(failedDestination), false);
  assert.equal(fs.readdirSync(directory).some((name) => name.endsWith(".part")), false);
});

function downloadSource(text) {
  return { body: streamFromChunks([new TextEncoder().encode(text)]) };
}

function failingStream() {
  let pulled = false;
  return new ReadableStream({
    pull(controller) {
      if (!pulled) {
        pulled = true;
        controller.enqueue(new TextEncoder().encode("partial"));
        return;
      }
      controller.error(new Error("connection interrupted"));
    }
  });
}

function streamFromChunks(chunks) {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      const chunk = chunks[index];
      index += 1;
      if (chunk === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
    }
  });
}

async function readText(body) {
  return new TextDecoder().decode(await new Response(body).arrayBuffer());
}
