#!/usr/bin/env node
/**
 * Cut 12.5 headless soak — Continuity M5 linked-device registry L1
 * (≠ Continuity Pass · ≠ Soft L3 · ≠ live sync).
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
  "src/cut12-lab-checklist.contract.test.ts",
  "src/cut12-continuity-m5-linked-devices.contract.test.ts",
  "src/continuity/continuity-linked-devices.test.ts",
  "src/continuity/lab-continuity-ports.test.ts",
  "src/continuity/resolve-continuity-ports.test.ts",
];

const main = async () => {
  console.log("cut12-lab-continuity-m5-soak: M5 registry · Continuity Pass not claimed · Soft L3 paused");

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
  log("A Cut 12.1–12.5 contracts + unit", vitest.code === 0, "vitest");
  if (vitest.code !== 0) {
    process.exit(1);
  }

  const build = await run("pnpm", ["run", "build"], desktopUiRoot, { shell: isWin });
  log("B desktop-ui vite build", build.code === 0);
  if (build.code !== 0) {
    process.exit(1);
  }

  console.log("Cut 12 soak Pass — Continuity Pass not claimed · Soft L3 paused · ≠ live sync");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
