#!/usr/bin/env node
/**
 * Cut 3.5 headless soak — Vite thin-shell L1 gates (≠ Soft L3).
 *
 * 1) Lab entry resolver selftest (3.4)
 * 2) desktop-ui Cut 3.1–3.3 contracts + vite build
 * 3) dual-entry config contract (3.4)
 *
 * Desktop L2 Vite checklist steps remain operator-owned.
 *
 * @see specs/backend/cut3-lab-milestone-checklist-2026-11-09.md
 * @see specs/backend/cut3-ui-vite-thin-shell-design-2026-11-09.md
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
  "src/cut3-no-pdk-invent.contract.test.ts",
  "src/cut3-private-trust-home-boundary.contract.test.ts",
  "src/cut3-dual-entry.contract.test.ts",
  "src/auth/auth-door-session.test.ts",
  "src/private-trust/lab-private-trust-ports.test.ts",
];

const main = async () => {
  console.log("cut3-lab-vite-shell-soak: Vite thin shell · Soft L3 Fixed not claimed");

  const selftest = await run(
    process.execPath,
    [resolve(repoRoot, "scripts/obscur-desktop-lab-entry.selftest.mjs")],
    repoRoot,
    { shell: false },
  );
  const selftestOk = selftest.code === 0;
  log("A Cut 3.4 lab-entry resolver", selftestOk);
  if (!selftestOk) {
    console.error("cut3-lab-vite-shell-soak: lab-entry selftest failed (≠ Soft L3 claim either way)");
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

  const vitest = await run(vitestCmd, vitestArgs, desktopUiRoot, { shell: vitestShell });
  const vitestOk = vitest.code === 0;
  log("B Cut 3.1–3.4 desktop-ui contracts", vitestOk, "vitest");
  if (!vitestOk) {
    console.error("cut3-lab-vite-shell-soak: desktop-ui L1 contracts failed (≠ Soft L3 claim either way)");
    process.exit(1);
  }

  const build = await run(
    "pnpm",
    ["run", "build"],
    desktopUiRoot,
    { shell: process.platform === "win32" },
  );
  const buildOk = build.code === 0;
  log("C Cut 3.1 vite build", buildOk);
  if (!buildOk) {
    console.error("cut3-lab-vite-shell-soak: vite build failed (≠ Soft L3 claim either way)");
    process.exit(1);
  }

  console.log("cut3-lab-vite-shell-soak: headless Vite-shell Pass (≠ Soft L3 Fixed)");
  console.log("Operator still owes desktop L2 checklist steps 1–8 in cut3-lab-milestone-checklist.");
  console.log("Production frontendDist remains apps/pwa/out — no silent beta wipe.");
};

main().catch((error) => {
  console.error(`cut3-lab-vite-shell-soak failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
