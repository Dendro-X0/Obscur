#!/usr/bin/env node
/**
 * Cut 5.4 headless soak — Vite production cutover L1 gates (≠ Soft L3).
 *
 * 1) production entry selftest (Vite default + Next rollback)
 * 2) desktop-ui Cut 5 + dual-entry contracts
 * 3) desktop-ui vite build
 *
 * Desktop L2 Vite-as-default checklist steps remain operator-owned.
 *
 * @see specs/backend/cut5-lab-milestone-checklist-2026-11-10.md
 * @see specs/backend/cut5-vite-production-cutover-design-2026-11-10.md
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
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
  "src/cut5-production-dist-flip.contract.test.ts",
  "src/cut5-production-opt-in.contract.test.ts",
  "src/cut5-production-cutover-readiness.contract.test.ts",
  "src/cut3-dual-entry.contract.test.ts",
  "src/cut5-lab-checklist.contract.test.ts",
];

const main = async () => {
  console.log("cut5-lab-vite-production-soak: Vite production default · Soft L3 Fixed not claimed");

  const conf = JSON.parse(
    readFileSync(resolve(repoRoot, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"),
  );
  const frontendDist = String(conf?.build?.frontendDist ?? "").replace(/\\/g, "/");
  const distOk = frontendDist === "../../desktop-ui/dist";
  log("0 committed frontendDist is Vite", distOk, frontendDist);
  if (!distOk) {
    console.error("cut5-lab-vite-production-soak: committed dist not flipped (≠ Soft L3 claim either way)");
    process.exit(1);
  }

  const selftest = await run(
    process.execPath,
    [resolve(repoRoot, "scripts/obscur-desktop-production-entry.selftest.mjs")],
    repoRoot,
  );
  const selftestOk = selftest.code === 0;
  log("A production entry selftest", selftestOk);
  if (!selftestOk) {
    console.error("cut5-lab-vite-production-soak: selftest failed (≠ Soft L3 claim either way)");
    process.exit(1);
  }

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
    // fall through to pnpm exec
  }

  const desktopVitest = await run(vitestCmd, vitestArgs, desktopUiRoot, { shell: vitestShell });
  const desktopOk = desktopVitest.code === 0;
  log("B Cut 5.1–5.4 desktop-ui contracts", desktopOk, "vitest");
  if (!desktopOk) {
    console.error("cut5-lab-vite-production-soak: desktop-ui L1 contracts failed (≠ Soft L3 claim either way)");
    process.exit(1);
  }

  const build = await run(
    "pnpm",
    ["run", "build"],
    desktopUiRoot,
    { shell: process.platform === "win32" },
  );
  const buildOk = build.code === 0;
  log("C Cut 5 vite build", buildOk);
  if (!buildOk) {
    console.error("cut5-lab-vite-production-soak: vite build failed (≠ Soft L3 claim either way)");
    process.exit(1);
  }

  console.log("cut5-lab-vite-production-soak: headless Vite-production Pass (≠ Soft L3 Fixed)");
  console.log("Operator still owes desktop L2 checklist steps 1–6 in cut5-lab-milestone-checklist.");
  console.log("Next rollback remains OBSCUR_DESKTOP_PRODUCTION_ENTRY=next — no silent beta wipe.");
};

main().catch((error) => {
  console.error(`cut5-lab-vite-production-soak failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
