#!/usr/bin/env node
/**
 * Cut 6.4 headless soak — release/CI Vite-align L1 gates (≠ Soft L3).
 *
 * @see specs/backend/cut6-lab-milestone-checklist-2026-11-10.md
 * @see specs/backend/cut6-release-ci-vite-align-design-2026-11-10.md
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
  "src/cut6-lab-checklist.contract.test.ts",
  "src/cut6-channel-download-face.contract.test.ts",
  "src/cut6-package-release-honesty.contract.test.ts",
  "src/cut6-mobile-ci-vite-align.contract.test.ts",
];

const main = async () => {
  console.log("cut6-lab-release-ci-soak: Vite desktop · mobile PWA overlay · Soft L3 Fixed not claimed");

  const conf = JSON.parse(
    readFileSync(resolve(repoRoot, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"),
  );
  const mobile = JSON.parse(
    readFileSync(resolve(repoRoot, "apps/desktop/src-tauri/tauri.mobile.conf.json"), "utf8"),
  );
  const desktopDist = String(conf?.build?.frontendDist ?? "").replace(/\\/g, "/");
  const mobileDist = String(mobile?.build?.frontendDist ?? "").replace(/\\/g, "/");
  const desktopOk = desktopDist === "../../desktop-ui/dist";
  const mobileOk = mobileDist === "../../pwa/out";
  log("0 desktop Vite + mobile PWA law", desktopOk && mobileOk, `${desktopDist} · ${mobileDist}`);
  if (!desktopOk || !mobileOk) {
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
    // fall through
  }

  const vitest = await run(vitestCmd, vitestArgs, desktopUiRoot, { shell: vitestShell });
  log("A Cut 6.1–6.4 contracts", vitest.code === 0, "vitest");
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

  console.log("cut6-lab-release-ci-soak: headless Pass (≠ Soft L3 Fixed)");
  console.log("Optional L4: pnpm desktop:package — Soft L3 still paused.");
};

main().catch((error) => {
  console.error(`cut6-lab-release-ci-soak failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
