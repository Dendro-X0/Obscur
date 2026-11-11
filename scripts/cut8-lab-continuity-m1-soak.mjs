#!/usr/bin/env node
/**
 * Cut 8.5 headless soak — native Continuity M1 L1 gates
 * (≠ Continuity Pass · ≠ Soft L3).
 *
 * @see specs/backend/cut8-lab-milestone-checklist-2026-11-10.md
 * @see specs/backend/cut8-native-continuity-m1-adapter-design-2026-11-10.md
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
  "src/cut8-lab-checklist.contract.test.ts",
  "src/cut8-continuity-resolve.contract.test.ts",
  "src/cut8-vite-continuity-ports.contract.test.ts",
  "src/cut8-continuity-m1-seal.contract.test.ts",
  "src/continuity/vite-continuity-m1-seal.test.ts",
  "src/continuity/vite-continuity-ports.test.ts",
  "src/continuity/resolve-continuity-ports.test.ts",
  "src/continuity/lab-continuity-ports.test.ts",
];

const main = async () => {
  console.log("cut8-lab-continuity-m1-soak: native Continuity M1 · Continuity Pass not claimed · Soft L3 paused");
  console.log("Law: no apps/pwa Continuity mega-import · unlock ≠ Continuity");

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
  log("A Cut 8.1–8.5 contracts + unit", vitest.code === 0, "vitest");
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

  console.log("Cut 8 soak Pass — Continuity Pass not claimed · Soft L3 paused");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
