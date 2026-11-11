#!/usr/bin/env node
/**
 * Cut 1.6 headless soak — replacement authority new path only (≠ Soft L3).
 *
 * 1) Run Cut 1.1–1.5 owner-uniqueness vitests (old path banned / gated).
 * 2) Reuse Cut 0 H-dc wire soak (health · envelope · poll).
 *
 * Desktop L2 sticky CRM / message restart steps remain operator checklist.
 *
 * @see specs/backend/cut1-lab-milestone-checklist-2026-11-09.md
 * @see specs/backend/cut1-replacement-authority-design-2026-11-09.md
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
      // Avoid shell:true with spaced paths (Windows Program Files\nodejs\node.exe).
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

const CUT1_VITEST_TARGETS = [
  "app/features/network/services/relationship-edge-authority.owner-uniqueness.contract.test.ts",
  "app/features/messaging/services/cut1-message-durability.owner-uniqueness.contract.test.ts",
  "app/features/messaging/services/cut1-outbox-ls.owner-uniqueness.contract.test.ts",
  "app/features/protocol-adaptation/cut1-private-trust-send-face.owner-uniqueness.contract.test.ts",
  "app/features/messaging/services/cut1-chat-state-demotion.owner-uniqueness.contract.test.ts",
  "app/features/dm-kernel/dm-kernel-chat-state-io-policy.test.ts",
  "app/features/dm-kernel/dm-kernel-chat-state-io.contract.test.ts",
];

const main = async () => {
  console.log("cut1-lab-new-path-soak: new path only · Soft L3 Fixed not claimed");

  const vitestBin = resolve(pwaRoot, "node_modules/vitest/vitest.mjs");
  let vitestArgs = ["exec", "vitest", "run", ...CUT1_VITEST_TARGETS];
  let vitestCmd = "pnpm";
  let vitestShell = process.platform === "win32";

  // Prefer local vitest via node (no shell — safe with spaced Program Files paths).
  try {
    require.resolve("vitest/package.json", { paths: [pwaRoot] });
    vitestCmd = process.execPath;
    vitestArgs = [vitestBin, "run", ...CUT1_VITEST_TARGETS];
    vitestShell = false;
  } catch {
    // fall through to pnpm exec
  }

  const l1 = await run(vitestCmd, vitestArgs, pwaRoot, { shell: vitestShell });
  const l1Ok = l1.code === 0;
  log("A Cut 1.1–1.5 owner-uniqueness L1", l1Ok, l1.error ? String(l1.error.message) : "vitest");
  if (!l1Ok) {
    console.error("cut1-lab-new-path-soak: L1 gate failed (≠ Soft L3 claim either way)");
    process.exit(1);
  }

  const hdc = await run(
    process.execPath,
    [resolve(repoRoot, "scripts/cut0-lab-hdc-t3-soak.mjs")],
    repoRoot,
    { shell: false },
  );
  const hdcOk = hdc.code === 0;
  log("B Cut 0 H-dc wire (health/envelope/poll)", hdcOk);
  if (!hdcOk) {
    console.error("cut1-lab-new-path-soak: H-dc wire failed (≠ Soft L3 claim either way)");
    process.exit(1);
  }

  console.log("cut1-lab-new-path-soak: headless new-path Pass (≠ Soft L3 Fixed)");
  console.log("Operator still owes desktop L2 checklist steps 1–8 in cut1-lab-milestone-checklist.");
};

main().catch((error) => {
  console.error(`cut1-lab-new-path-soak failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
