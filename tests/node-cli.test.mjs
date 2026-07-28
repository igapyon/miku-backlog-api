import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const CLI = "bundle/backlog-api.mjs";

test("CLI metadata commands do not require credentials", () => {
  const version = run(["--version"]);
  assert.equal(version.status, 0);
  assert.equal(version.stdout, "0.4.0\n");
  assert.equal(version.stderr, "");

  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.equal(help.stderr, "");
  assert.match(help.stdout, /backlog-api call <operation>/);
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
  assert.doesNotMatch(
    help.stdout,
    /^\s*backlog-api call delete_issue .*--allow DELETE/m
  );

  const catalog = JSON.parse(run(["tools", "list"]).stdout);
  assert.equal(catalog.operations.length, 59);
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
