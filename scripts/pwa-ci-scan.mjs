#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const pwaDir = resolve(repoRoot, "apps/pwa");
const artifactsDir = resolve(repoRoot, ".artifacts");
mkdirSync(artifactsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const logPath = resolve(artifactsDir, `pwa-ci-scan-${timestamp}.log`);

/** @type {string[]} */
const lines = [];

const run = (command, args, cwd) =>
  new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      env: process.env,
    });

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      lines.push(...text.split(/\r?\n/));
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      process.stderr.write(text);
      lines.push(...text.split(/\r?\n/));
    });
    child.on("close", (code) => resolveRun(code ?? 1));
  });

const summarize = (inputLines) => {
  const patterns = [
    /Type error:\s.+/i,
    /Module not found:\s.+/i,
    /Export .+ doesn't exist/i,
    /error TS\d+:.+/i,
    /ELIFECYCLE.+/i,
  ];
  const summary = [];
  const seen = new Set();
  for (const raw of inputLines) {
    const line = raw.trim();
    if (!line) continue;
    if (!patterns.some((p) => p.test(line))) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    summary.push(line);
    if (summary.length >= 80) break;
  }
  return summary;
};

const main = async () => {
  const steps = [
    { label: "install", cwd: pwaDir, cmd: "pnpm", args: ["install", "--frozen-lockfile"] },
    { label: "typecheck", cwd: pwaDir, cmd: "pnpm", args: ["exec", "tsc", "--noEmit", "--pretty", "false"] },
    { label: "build", cwd: pwaDir, cmd: "pnpm", args: ["build"] },
  ];

  let failedStep = null;
  for (const step of steps) {
    process.stdout.write(`\n[ci-scan] running ${step.label}...\n`);
    const code = await run(step.cmd, step.args, step.cwd);
    if (code !== 0) {
      failedStep = step.label;
      break;
    }
  }

  writeFileSync(logPath, lines.join("\n"), "utf8");
  const summary = summarize(lines);
  const summaryPath = logPath.replace(/\.log$/, ".summary.txt");
  const summaryText = [
    `failed_step=${failedStep ?? "none"}`,
    `log=${logPath}`,
    "",
    ...summary,
  ].join("\n");
  writeFileSync(summaryPath, summaryText, "utf8");

  process.stdout.write(`\n[ci-scan] full log: ${logPath}\n`);
  process.stdout.write(`[ci-scan] summary:  ${summaryPath}\n`);
  if (summary.length > 0) {
    process.stdout.write("[ci-scan] key failures:\n");
    summary.slice(0, 20).forEach((line) => process.stdout.write(`  - ${line}\n`));
  }

  process.exit(failedStep ? 1 : 0);
};

void main();

