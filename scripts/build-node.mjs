#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const bundleDir = path.resolve(root, "bundle");
const distDir = path.resolve(root, "dist");
fs.mkdirSync(bundleDir, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });

const cliBuild = await build({
  entryPoints: [path.resolve(root, "src", "cli.mjs")],
  outfile: path.resolve(bundleDir, "backlog-api.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  metafile: true,
  banner: {
    js: "import { createRequire as __backlogApiCreateRequire } from 'node:module'; const require = __backlogApiCreateRequire(import.meta.url);"
  }
});
fs.writeFileSync(
  path.resolve(bundleDir, "backlog-api-meta.json"),
  `${JSON.stringify(cliBuild.metafile, null, 2)}\n`
);

const runtimeBuild = await build({
  entryPoints: [path.resolve(root, "src", "runtime.mjs")],
  outfile: path.resolve(bundleDir, "backlog-api-runtime.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  metafile: true,
  banner: {
    js: "import { createRequire as __backlogApiCreateRequire } from 'node:module'; const require = __backlogApiCreateRequire(import.meta.url);"
  }
});
fs.writeFileSync(
  path.resolve(bundleDir, "backlog-api-runtime-meta.json"),
  `${JSON.stringify(runtimeBuild.metafile, null, 2)}\n`
);

fs.copyFileSync(path.resolve(bundleDir, "backlog-api.mjs"), path.resolve(distDir, "cli.mjs"));
const sourcesPath = path.resolve(bundleDir, "backlog-api-sources.tgz");
fs.rmSync(sourcesPath, { force: true });
execFileSync(
  "tar",
  [
    "-czf",
    sourcesPath,
    "src",
    "docs/traceability",
    "package.json",
    "package-lock.json",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "licenses"
  ],
  { cwd: root, stdio: "inherit" }
);

process.stdout.write(`[build:node] generated bundle/backlog-api.mjs\n`);
process.stdout.write(`[build:node] generated bundle/backlog-api-runtime.mjs\n`);
