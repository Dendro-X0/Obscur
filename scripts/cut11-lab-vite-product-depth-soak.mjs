#!/usr/bin/env node
/**
 * Cut 11.5 headless soak — Vite product-depth L1 gates
 * (≠ Continuity Pass · ≠ Soft L3).
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
  "src/cut11-lab-checklist.contract.test.ts",
  "src/cut11-vite-product-depth.contract.test.ts",
  "src/auth/vite-identity-create.test.ts",
  "src/private-trust/vite-private-dc-session.test.ts",
];

const main = async () => {
  console.log("cut11-lab-vite-product-depth-soak: Continuity Pass not claimed · Soft L3 paused");

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
  log("A Cut 11.1–11.5 contracts + unit", vitest.code === 0, "vitest");
  if (vitest.code !== 0) {
    process.exit(1);
  }

  const build = await run("pnpm", ["run", "build"], desktopUiRoot, { shell: isWin });
  log("B desktop-ui vite build", build.code === 0);
  if (build.code !== 0) {
    process.exit(1);
  }

  console.log("Cut 11 soak Pass — Continuity Pass not claimed · Soft L3 paused");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
