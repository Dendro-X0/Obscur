#!/usr/bin/env node
/**
 * Remaster R2 headless soak — create→home→T3 face→Continuity L1
 * (≠ Continuity Pass · ≠ Soft L3 Fixed).
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
  "src/remaster-r1-path.contract.test.ts",
  "src/remaster-r2-checklist.contract.test.ts",
  "src/remaster-r2-e2e-path.test.ts",
  "src/auth/vite-identity-create.test.ts",
  "src/private-trust/vite-private-dc-session.test.ts",
  "src/private-trust/lab-private-trust-ports.test.ts",
  "src/private-trust/native-private-trust-ports.test.ts",
  "src/settings/vite-settings-residue.test.ts",
  "src/continuity/vite-continuity-m2-home.test.ts",
];

const main = async () => {
  console.log("remaster-r2-lab-soak: remaster E2E · Continuity Pass not claimed · Soft L3 paused");

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
  log("A Remaster R1–R2 contracts + E2E", vitest.code === 0, "vitest");
  if (vitest.code !== 0) {
    process.exit(1);
  }

  const build = await run("pnpm", ["run", "build"], desktopUiRoot, { shell: isWin });
  log("B desktop-ui vite build", build.code === 0);
  if (build.code !== 0) {
    process.exit(1);
  }

  console.log("Remaster R2 soak Pass — Continuity Pass not claimed · Soft L3 paused");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
