#!/usr/bin/env node
/**
 * Cut 2.4 headless soak — private-trust product face (≠ Soft L3).
 *
 * 1) Run Cut 2.1–2.3 L1 vitests (default protocol · compose honesty · invite policy).
 * 2) Reuse Cut 1 new-path soak (authority L1 + H-dc wire).
 *
 * Desktop L2 compose checklist steps remain operator-owned.
 *
 * @see specs/backend/cut2-lab-milestone-checklist-2026-11-09.md
 * @see specs/backend/cut2-private-trust-product-face-design-2026-11-09.md
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
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

const CUT2_VITEST_TARGETS = [
  "app/features/protocol-adaptation/preferences.cut2-default.test.ts",
  "app/features/protocol-adaptation/cut2-default-protocol.owner-uniqueness.contract.test.ts",
  "app/features/protocol-adaptation/private-trust-compose-policy.test.ts",
  "app/features/protocol-adaptation/cut2-compose-honesty.owner-uniqueness.contract.test.ts",
  "app/features/protocol-adaptation/components/protocol-capability-chips.test.tsx",
  "app/features/messaging/controllers/v2/dm-send-with-retry.cut2.test.ts",
  "app/features/protocol-adaptation/private-trust-invite-policy.test.ts",
  "app/features/protocol-adaptation/cut2-invite-policy.owner-uniqueness.contract.test.ts",
];

const main = async () => {
  console.log("cut2-lab-product-face-soak: product face · Soft L3 Fixed not claimed");

  const vitestBin = resolve(pwaRoot, "node_modules/vitest/vitest.mjs");
  let vitestArgs = ["exec", "vitest", "run", ...CUT2_VITEST_TARGETS];
  let vitestCmd = "pnpm";
  let vitestShell = process.platform === "win32";

  try {
    require.resolve("vitest/package.json", { paths: [pwaRoot] });
    vitestCmd = process.execPath;
    vitestArgs = [vitestBin, "run", ...CUT2_VITEST_TARGETS];
    vitestShell = false;
  } catch {
    // fall through to pnpm exec
  }

  const l1 = await run(vitestCmd, vitestArgs, pwaRoot, { shell: vitestShell });
  const l1Ok = l1.code === 0;
  log("A Cut 2.1–2.3 product-face L1", l1Ok, l1.error ? String(l1.error.message) : "vitest");
  if (!l1Ok) {
    console.error("cut2-lab-product-face-soak: L1 gate failed (≠ Soft L3 claim either way)");
    process.exit(1);
  }

  const cut1 = await run(
    process.execPath,
    [resolve(repoRoot, "scripts/cut1-lab-new-path-soak.mjs")],
    repoRoot,
    { shell: false },
  );
  const cut1Ok = cut1.code === 0;
  log("B Cut 1 new-path + H-dc wire", cut1Ok);
  if (!cut1Ok) {
    console.error("cut2-lab-product-face-soak: Cut 1/H-dc gate failed (≠ Soft L3 claim either way)");
    process.exit(1);
  }

  console.log("cut2-lab-product-face-soak: headless product-face Pass (≠ Soft L3 Fixed)");
  console.log("Operator still owes desktop L2 checklist steps 1–8 in cut2-lab-milestone-checklist.");
};

main().catch((error) => {
  console.error(`cut2-lab-product-face-soak failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
