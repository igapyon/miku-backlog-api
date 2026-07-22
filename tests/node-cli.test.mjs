import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const CLI = "bundle/backlog-api.mjs";

test("CLI metadata commands do not require credentials", () => {
  assert.equal(run(["--version"]).stdout.trim(), "0.3.0");
  assert.match(run(["--help"]).stdout, /backlog-api call <operation>/);

  const catalog = JSON.parse(run(["tools", "list"]).stdout);
  assert.equal(catalog.operations.length, 58);
});

test("CLI returns a structured confirmation error for destructive calls", () => {
  const result = run(["call", "delete_issue", "--input", "-"], '{"issueKey":"TEST-1"}');
  assert.equal(result.status, 1);
  const body = JSON.parse(result.stdout);
  assert.equal(body.success, false);
  assert.equal(body.diagnostics[0].code, "CONFIRMATION_REQUIRED");
});

function run(args, input = "") {
  const result = spawnSync("node", [CLI, ...args], {
    cwd: process.cwd(),
    input,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot
    }
  });
  assert.equal(result.signal, null);
  return result;
}
