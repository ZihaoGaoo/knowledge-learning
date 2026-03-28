#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const agentDir = resolve(currentDir, "..");
const cliPath = resolve(agentDir, "cli.ts");
const envFile = resolve(agentDir, "../.env");

const nodeArgs = [];

if (existsSync(envFile)) {
  nodeArgs.push(`--env-file=${envFile}`);
}

nodeArgs.push("--import", "tsx", cliPath, ...process.argv.slice(2));

const child = spawn(process.execPath, nodeArgs, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
