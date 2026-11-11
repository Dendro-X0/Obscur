#!/usr/bin/env node
/**
 * Cut 4.4 headless soak — Vite native-port L1 gates (≠ Soft L3).
 *
 * 1) desktop-ui Cut 4 selection + unlock/home contracts
 * 2) package private-trust home client + T3 unit tests
 * 3) desktop-ui vite build
 *
 * Desktop L2 Vite checklist steps remain operator-owned.
 *
 * @see specs/backend/cut4-lab-milestone-checklist-2026-11-09.md
 * @see specs/backend/cut4-vite-native-port-wire-design-2026-11-09.md
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const desktopUiRoot = resolve(repoRoot, "apps/desktop-ui");
const pwaRoot = resolve(repoRoot, "apps/pwa");
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
  "src/cut4-no-pwa-unlock-import.contract.test.ts",
  "src/cut4-adapter-selection.contract.test.ts",
  "src/runtime/desktop-ui-adapter-selection.test.ts",
  "src/auth/resolve-device-unlock-port.test.ts",
  "src/auth/vite-passphrase-device-unlock.test.ts",
  "src/private-trust/resolve-private-trust-ports.test.ts",
  "src/private-trust/native-private-trust-ports.test.ts",
  "src/private-trust/vite-private-dc-session.test.ts",
  "src/cut3-no-pdk-invent.contract.test.ts",
  "src/cut3-private-trust-home-boundary.contract.test.ts",
];

const PACKAGE_VITEST_TARGETS = [
  "../../packages/obscur-private-trust-engine/src/private-dc-home-client.test.ts",
  "../../packages/obscur-private-trust-engine/src/private-trust-t3-send.test.ts",
  "../../packages/obscur-private-trust-engine/src/private-trust-home-list.test.ts",
  "../../packages/obscur-auth-engine/src/device-unlock-adapter.test.ts",
];

const main = async () => {
  console.log("cut4-lab-vite-native-soak: Vite native ports · Soft L3 Fixed not claimed");

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
  log("A Cut 4.1–4.4 desktop-ui contracts", desktopOk, "vitest");
  if (!desktopOk) {
    console.error("cut4-lab-vite-native-soak: desktop-ui L1 contracts failed (≠ Soft L3 claim either way)");
    process.exit(1);
  }

  const packageVitest = await run(
    "pnpm",
    ["exec", "vitest", "run", ...PACKAGE_VITEST_TARGETS],
    pwaRoot,
    { shell: process.platform === "win32" },
  );
  const packageOk = packageVitest.code === 0;
  log("B Cut 4 package unlock/T3/home-client", packageOk, "vitest");
  if (!packageOk) {
    console.error("cut4-lab-vite-native-soak: package L1 failed (≠ Soft L3 claim either way)");
    process.exit(1);
  }

  const build = await run(
    "pnpm",
    ["run", "build"],
    desktopUiRoot,
    { shell: process.platform === "win32" },
  );
  const buildOk = build.code === 0;
  log("C Cut 4 vite build", buildOk);
  if (!buildOk) {
    console.error("cut4-lab-vite-native-soak: vite build failed (≠ Soft L3 claim either way)");
    process.exit(1);
  }

  console.log("cut4-lab-vite-native-soak: headless Vite-native Pass (≠ Soft L3 Fixed)");
  console.log("Operator still owes desktop L2 checklist steps 1–8 in cut4-lab-milestone-checklist.");
  console.log("Production frontendDist remains apps/pwa/out — no silent beta wipe.");
};

main().catch((error) => {
  console.error(`cut4-lab-vite-native-soak failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
