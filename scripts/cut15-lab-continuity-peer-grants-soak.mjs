#!/usr/bin/env node
/**
 * Cut 15.5 headless soak — Continuity peer history grants L1
 * (≠ Continuity Pass · ≠ Soft L3 · ≠ invent CRM · ≠ live sync).
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopUiRoot = resolve(__dirname, "../apps/desktop-ui");
const require = createRequire(import.meta.url);
const isWin = process.platform === "win32";

const log = (step, ok, detail) => {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${step}${detail ? ` — ${detail}` : ""}`);
};

const run = (command, args, cwd, options = {}) =>
  new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: options.shell === true,
      env: process.env,
    });
    child.on("error", (error) => {
      resolvePromise({ code: 1, error });
    });
    child.on("close", (code) => {
      resolvePromise({ code: code ?? 1 });
    });
  });

const TARGETS = [
  "src/cut15-lab-checklist.contract.test.ts",
  "src/cut15-continuity-peer-history-grants.contract.test.ts",
  "src/continuity/continuity-peer-history-grant.test.ts",
  "src/continuity/lab-continuity-ports.test.ts",
  "src/continuity/resolve-continuity-ports.test.ts",
];

const main = async () => {
  console.log("cut15-lab-continuity-peer-grants-soak: peer grants · Continuity Pass not claimed · Soft L3 paused");

  let vitestCmd = "pnpm";
  let vitestArgs = ["exec", "vitest", "run", ...TARGETS];
  let vitestShell = isWin;
  try {
    require.resolve("vitest/package.json", { paths: [desktopUiRoot] });
    vitestCmd = process.execPath;
    vitestArgs = [
      resolve(desktopUiRoot, "node_modules/vitest/vitest.mjs"),
      "run",
      ...TARGETS,
    ];
    vitestShell = false;
  } catch {
    // fall through
  }

  const vitest = await run(vitestCmd, vitestArgs, desktopUiRoot, { shell: vitestShell });
  log("A Cut 15.1–15.5 contracts + unit", vitest.code === 0, "vitest");
  if (vitest.code !== 0) {
    process.exit(1);
  }

  const build = await run("pnpm", ["run", "build"], desktopUiRoot, { shell: isWin });
  log("B desktop-ui vite build", build.code === 0);
  if (build.code !== 0) {
    process.exit(1);
  }

  console.log("Cut 15 soak Pass — Continuity Pass not claimed · Soft L3 paused · ≠ invent CRM");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
