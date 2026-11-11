#!/usr/bin/env node
/**
 * Cut 7.5 headless soak — Continuity M1 L1 gates (≠ Continuity Pass · ≠ Soft L3).
 * Includes Cut 7.3 CHAT_STATE_AS_SOLE_CRM_REFUSED law via contracts.
 *
 * @see specs/backend/cut7-lab-milestone-checklist-2026-11-10.md
 * @see specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const desktopUiRoot = resolve(repoRoot, "apps/desktop-ui");
const require = createRequire(import.meta.url);

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

const DESKTOP_UI_VITEST_TARGETS = [
  "src/cut7-lab-checklist.contract.test.ts",
  "src/cut7-continuity-door.contract.test.ts",
  "src/cut7-t3-sqlite-authority.contract.test.ts",
  "src/cut7-sealed-snapshot-inventory.contract.test.ts",
  "src/cut7-continuity-m1-law.contract.test.ts",
  "src/continuity/lab-continuity-ports.test.ts",
  "src/continuity/t3-authority-policy.test.ts",
  "src/continuity/sealed-snapshot-inventory.test.ts",
];

const main = async () => {
  console.log("cut7-lab-continuity-m1-soak: Continuity M1 · Continuity Pass not claimed · Soft L3 paused");
  console.log("Law: CHAT_STATE_AS_SOLE_CRM_REFUSED · unlock ≠ Continuity");

  let vitestCmd = "pnpm";
  let vitestArgs = ["exec", "vitest", "run", ...DESKTOP_UI_VITEST_TARGETS];
  let vitestShell = process.platform === "win32";
  try {
    require.resolve("vitest/package.json", { paths: [desktopUiRoot] });
    vitestCmd = process.execPath;
    vitestArgs = [
      resolve(desktopUiRoot, "node_modules/vitest/vitest.mjs"),
      "run",
      ...DESKTOP_UI_VITEST_TARGETS,
    ];
    vitestShell = false;
  } catch {
    // fall through
  }

  const vitest = await run(vitestCmd, vitestArgs, desktopUiRoot, { shell: vitestShell });
  log("A Cut 7.1–7.5 contracts", vitest.code === 0, "vitest");
  if (vitest.code !== 0) {
    process.exit(1);
  }

  const build = await run("pnpm", ["run", "build"], desktopUiRoot, {
    shell: process.platform === "win32",
  });
  log("B desktop-ui vite build", build.code === 0);
  if (build.code !== 0) {
    process.exit(1);
  }

  console.log("cut7-lab-continuity-m1-soak: headless Pass (≠ Continuity Pass · ≠ Soft L3 Fixed)");
  console.log("Optional L2: Next Settings M1 file round-trip · Soft L3 still paused.");
};

main().catch((error) => {
  console.error(`cut7-lab-continuity-m1-soak failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
