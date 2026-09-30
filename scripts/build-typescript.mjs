#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const tsc = path.resolve(root, "node_modules", "typescript", "bin", "tsc");

execFileSync(process.execPath, [tsc], { cwd: root, stdio: "inherit" });

const mappingSource = path.resolve(
  root,
  "docs",
  "traceability",
  "upstream-tool-mapping.json"
);
const mappingTarget = path.resolve(
  root,
  "dist",
  "docs",
  "traceability",
  "upstream-tool-mapping.json"
);
fs.mkdirSync(path.dirname(mappingTarget), { recursive: true });
fs.copyFileSync(mappingSource, mappingTarget);
