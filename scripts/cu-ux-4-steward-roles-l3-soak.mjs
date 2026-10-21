#!/usr/bin/env node
/**
 * CU-UX-4 L3 soak — managed Docker path preflight + steward mutation contract.
 *
 * Requires: relay ws://127.0.0.1:7000 · coordination http://127.0.0.1:8787/health
 * Usage: node scripts/cu-ux-4-steward-roles-l3-soak.mjs
 *
 * Claims:
 *   L3-stack — Docker relay + coordination healthy
 *   L3-shell — static out contains steward UI markers
 *   L3-policy — promote/demote/last_steward against live imports
 * Dual-profile UI promote remains operator follow-on when CDP attach available.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import net from "node:net";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RELAY_HOST = "127.0.0.1";
const RELAY_PORT = 7000;
const COORD_HEALTH = process.env.OBSCUR_COORDINATION_URL?.replace(/\/$/, "") || "http://127.0.0.1:8787";
const outJson = path.join(repoRoot, "docs", "handoffs", "cu-ux-4-steward-roles-l3-soak-latest.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "cu-ux-4-steward-roles-l3-soak-latest.md");

const STEWARD_A = "a".repeat(64);
const STEWARD_B = "b".repeat(64);
const MEMBER_C = "c".repeat(64);

const checks = [];
const record = (id, ok, detail) => {
  checks.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${detail}`);
};

const tcpOpen = (host, port, timeoutMs = 3000) => new Promise((resolve) => {
  const socket = net.connect({ host, port });
  const done = (ok) => {
    socket.destroy();
    resolve(ok);
  };
  socket.setTimeout(timeoutMs);
  socket.on("connect", () => done(true));
  socket.on("timeout", () => done(false));
  socket.on("error", () => done(false));
});

const fetchOk = async (url) => {
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    return { ok: res.ok, status: res.status };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
};

const findInOut = (needle) => {
  const outDir = path.join(repoRoot, "apps", "pwa", "out");
  if (!fs.existsSync(outDir)) {
    return false;
  }
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (walk(full)) {
          return true;
        }
        continue;
      }
      if (!entry.name.endsWith(".js") && !entry.name.endsWith(".json")) {
        continue;
      }
      const text = fs.readFileSync(full, "utf8");
      if (text.includes(needle)) {
        return true;
      }
    }
    return false;
  };
  return walk(outDir);
};

const main = async () => {
  console.log("CU-UX-4 steward roles L3 soak");

  const relayUp = await tcpOpen(RELAY_HOST, RELAY_PORT);
  record("L3-stack-relay", relayUp, relayUp ? `tcp ${RELAY_HOST}:${RELAY_PORT}` : "relay port closed");

  const coord = await fetchOk(`${COORD_HEALTH}/health`);
  record(
    "L3-stack-coordination",
    coord.ok,
    coord.ok ? `${COORD_HEALTH}/health → ${coord.status}` : `coord unhealthy: ${coord.status || coord.error}`,
  );

  const shellHasBadge = findInOut("member-steward-badge");
  const shellHasMake = findInOut("groups.management.members.makeSteward") || findInOut("Make steward");
  record(
    "L3-shell-steward-ui",
    shellHasBadge && shellHasMake,
    `badge=${shellHasBadge} makeStewardKey=${shellHasMake}`,
  );

  const require = createRequire(path.join(repoRoot, "apps", "pwa", "package.json"));
  // Dynamic import of TS via vitest path is heavy; load compiled logic by spawning node --experimental
  // Prefer direct import through vite-node unavailable — use policy via file URL after transpile skip.
  // Import the source through the apps/pwa vitest-friendly relative path by evaluating with tsx if present.
  let policyOk = false;
  let policyDetail = "import_failed";
  try {
    const policyPath = path.join(
      repoRoot,
      "apps",
      "pwa",
      "app",
      "features",
      "groups",
      "services",
      "community-steward-policy.ts",
    );
    // Prefer already-proven vitest; call node to run a tiny inline check via playwright-free require of dist if any.
    // Fall back: re-implement critical asserts by spawning vitest file filter (authoritative).
    const { spawnSync } = await import("node:child_process");
    const vitest = spawnSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["vitest", "run", "app/features/groups/services/community-steward-policy.test.ts"],
      {
        cwd: path.join(repoRoot, "apps", "pwa"),
        encoding: "utf8",
        shell: true,
        env: process.env,
      },
    );
    policyOk = vitest.status === 0;
    policyDetail = policyOk
      ? "vitest community-steward-policy (promote/demote/last_steward/T0)"
      : (vitest.stderr || vitest.stdout || "vitest failed").slice(0, 400);
    void policyPath;
    void require;
  } catch (error) {
    policyDetail = error instanceof Error ? error.message : String(error);
  }
  record("L3-policy-contract", policyOk, policyDetail);

  // Document expected dual-profile UI steps (not automated here).
  record(
    "L3-ui-dual-profile-promote",
    false,
    "Skipped — needs unlocked A/B profiles: Save operator relay ws://localhost:7000 → Create Team → invite B → Make steward. CDP attach when Playwright ready.",
  );

  const failed = checks.filter((c) => !c.ok && c.id !== "L3-ui-dual-profile-promote");
  const uiSkipped = checks.find((c) => c.id === "L3-ui-dual-profile-promote");
  const stackPass = checks.filter((c) => c.id.startsWith("L3-stack") || c.id.startsWith("L3-shell") || c.id === "L3-policy-contract").every((c) => c.ok);

  const report = {
    schema: "cu-ux-4-steward-roles-l3-soak@1",
    at: new Date().toISOString(),
    relay: `ws://${RELAY_HOST}:${RELAY_PORT}`,
    coordination: COORD_HEALTH,
    checks,
    stackAndPolicyPass: stackPass,
    uiDualProfile: uiSkipped?.ok === true ? "Pass" : "Skipped",
    claim: stackPass
      ? "L3-stack+policy Pass · dual-profile UI promote still Skipped"
      : "L3 FAIL — fix stack/shell/policy before UI soak",
  };

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const md = `# CU-UX-4 steward roles L3 soak

**At:** ${report.at}  
**Claim:** ${report.claim}

| Check | Result | Detail |
|-------|--------|--------|
${checks.map((c) => `| ${c.id} | ${c.ok ? "Pass" : (c.id === "L3-ui-dual-profile-promote" ? "Skipped" : "Fail")} | ${c.detail.replace(/\|/g, "\\|")} |`).join("\n")}

## Operator dual-profile (when ready)

1. Profile A: Settings → Relays → Save team workspace \`ws://localhost:7000\` + coordination \`${COORD_HEALTH}\`.
2. Create **My team relay** group; confirm Steward badge on self.
3. Invite Profile B; B joins.
4. A → Members → Make steward on B; B shows Steward badge.
5. Attempt Remove steward on last remaining steward → blocked toast.

Evidence JSON: \`${path.relative(repoRoot, outJson).replace(/\\\\/g, "/")}\`
`;
  fs.writeFileSync(outMd, md, "utf8");

  console.log(report.claim);
  console.log(`Wrote ${outJson}`);
  process.exit(stackPass ? 0 : 1);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
