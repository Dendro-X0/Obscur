#!/usr/bin/env node
/**
 * Cut 9.5 headless soak — Continuity M2 auto-DC L1 gates
 * (≠ Continuity Pass · ≠ Soft L3).
 *
 * @see specs/backend/cut9-lab-milestone-checklist-2026-11-10.md
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const desktopUiRoot = resolve(repoRoot, "apps/desktop-ui");
const engineRoot = resolve(repoRoot, "packages/obscur-private-trust-engine");
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

const DESKTOP_UI_VITEST_TARGETS = [
  "src/cut9-lab-checklist.contract.test.ts",
  "src/cut9-continuity-m2-home.contract.test.ts",
  "src/continuity/vite-continuity-m2-home.test.ts",
  "src/continuity/lab-continuity-ports.test.ts",
  "src/continuity/resolve-continuity-ports.test.ts",
];

const main = async () => {
  console.log("cut9-lab-continuity-m2-soak: Continuity M2 · Continuity Pass not claimed · Soft L3 paused");

  const engine = await run(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "../../packages/obscur-private-trust-engine/src/private-dc-home-client.test.ts",
    ],
    desktopUiRoot,
    { shell: isWin },
  );
  log("A Continuity M2 home client", engine.code === 0, "vitest via desktop-ui");
  if (engine.code !== 0) {
    process.exit(1);
  }

  let vitestCmd = "pnpm";
  let vitestArgs = ["exec", "vitest", "run", ...DESKTOP_UI_VITEST_TARGETS];
  let vitestShell = isWin;
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
  log("B Cut 9.1–9.5 desktop-ui contracts", vitest.code === 0, "vitest");
  if (vitest.code !== 0) {
    process.exit(1);
  }

  const build = await run("pnpm", ["run", "build"], desktopUiRoot, { shell: isWin });
  log("C desktop-ui vite build", build.code === 0);
  if (build.code !== 0) {
    process.exit(1);
  }

  console.log("Cut 9 soak Pass — Continuity Pass not claimed · Soft L3 paused");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
