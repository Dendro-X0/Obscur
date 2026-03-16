#!/usr/bin/env node

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const tempWorktreeDir = resolve(repoRoot, ".tmp-ci-head");
const MAX_CLEANUP_ATTEMPTS = 8;
const CLEANUP_RETRY_DELAY_MS = 250;

const run = (command, args, cwd = repoRoot, stdio = "inherit") =>
  new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: process.env,
      stdio,
    });
    child.on("close", (code) => resolveRun(code ?? 1));
  });

const runCapture = (command, args, cwd = repoRoot) =>
  new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => resolveRun({ code: code ?? 1, stdout, stderr }));
  });

const sleep = (ms) =>
  new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });

const removeTempDir = () => {
  if (!existsSync(tempWorktreeDir)) {
    return true;
  }

  try {
    rmSync(tempWorktreeDir, { recursive: true, force: true });
    return !existsSync(tempWorktreeDir);
  } catch {
    return false;
  }
};

const normalizePath = (value) => value.replaceAll("\\", "/").toLowerCase();

const isTempWorktreeRegistered = async () => {
  const output = await runCapture("git", ["worktree", "list", "--porcelain"], repoRoot);
  if (output.code !== 0) {
    return false;
  }
  const target = normalizePath(tempWorktreeDir);
  return output.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .some((line) => normalizePath(line.slice("worktree ".length).trim()) === target);
};

const cleanupTempDir = async () => {
  for (let attempt = 1; attempt <= MAX_CLEANUP_ATTEMPTS; attempt += 1) {
    if (await isTempWorktreeRegistered()) {
      await run("git", ["worktree", "remove", "--force", tempWorktreeDir], repoRoot, "ignore");
    }
    await run("git", ["worktree", "prune"], repoRoot, "ignore");

    if (removeTempDir()) {
      return true;
    }

    await sleep(CLEANUP_RETRY_DELAY_MS * attempt);
  }

  return !existsSync(tempWorktreeDir);
};

const main = async () => {
  await cleanupTempDir();
  const addCode = await run("git", ["worktree", "add", "--detach", tempWorktreeDir, "HEAD"], repoRoot, "inherit");
  if (addCode !== 0) {
    process.exit(addCode);
  }

  let exitCode = 0;
  try {
    exitCode = await run("node", ["scripts/pwa-ci-scan.mjs"], tempWorktreeDir, "inherit");
  } finally {
    const cleaned = await cleanupTempDir();
    if (!cleaned) {
      console.warn(
        `[ci-scan] warning: unable to fully remove temporary worktree at ${tempWorktreeDir}.`
      );
    }
  }

  process.exit(exitCode);
};

void main();
