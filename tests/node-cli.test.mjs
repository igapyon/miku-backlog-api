import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const CLI = "bundle/backlog-api.mjs";

test("CLI metadata commands do not require credentials", () => {
  const version = run(["--version"]);
  assert.equal(version.status, 0);
  assert.equal(version.stdout, "0.3.2\n");
  assert.equal(version.stderr, "");

  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.equal(help.stderr, "");
  assert.match(help.stdout, /backlog-api call <operation>/);
  assert.match(help.stdout, /machine-readable JSON to stdout/);
  assert.match(help.stdout, /--confirm-destructive/);
  assert.match(help.stdout, /Exit codes:/);

  const catalog = JSON.parse(run(["tools", "list"]).stdout);
  assert.equal(catalog.operations.length, 58);
  assert.equal(
    catalog.operations.find((operation) => operation.name === "get_issue").requiredPermission,
    "READ"
  );
  assert.equal(
    catalog.operations.find((operation) => operation.name === "add_issue").requiredPermission,
    "CREATE"
  );
});

test("CLI allows READ only by default and checks permissions before credentials", () => {
  const denied = run(["call", "add_issue", "--input", "-"], "{}");
  assert.equal(denied.status, 1);
  assert.equal(JSON.parse(denied.stdout).diagnostics[0].code, "PERMISSION_REQUIRED");

  const allowed = run(
    ["call", "add_issue", "--input", "-", "--allow", "READ,CREATE"],
    "{}"
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
    '{"issueKey":"TEST-1"}'
  );
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
