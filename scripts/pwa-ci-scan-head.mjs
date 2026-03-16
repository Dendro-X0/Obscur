#!/usr/bin/env node

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const tempWorktreeDir = resolve(repoRoot, ".tmp-ci-head");

const run = (command, args, cwd = repoRoot) =>
  new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: process.env,
      stdio: "inherit",
    });
    child.on("close", (code) => resolveRun(code ?? 1));
  });

const cleanupTempDir = () => {
  if (existsSync(tempWorktreeDir)) {
    rmSync(tempWorktreeDir, { recursive: true, force: true });
  }
};

const main = async () => {
  cleanupTempDir();
  const addCode = await run("git", ["worktree", "add", "--detach", tempWorktreeDir, "HEAD"]);
  if (addCode !== 0) {
    process.exit(addCode);
  }

  let exitCode = 0;
  try {
    exitCode = await run("node", ["scripts/pwa-ci-scan.mjs"], tempWorktreeDir);
  } finally {
    await run("git", ["worktree", "remove", "--force", tempWorktreeDir], repoRoot);
    cleanupTempDir();
  }

  process.exit(exitCode);
};

void main();
