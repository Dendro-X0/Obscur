#!/usr/bin/env node
/**
 * Optional web L3 — TS conduit mesh live soak.
 *
 * Prefers Docker ws://127.0.0.1:7000; vitest falls back to ephemeral lab stub.
 *
 * Usage: node scripts/l3-mesh-web-soak.mjs
 * Optional: pnpm dev:relay:docker  (stronger parity with desktop L3-product)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RELAY_URL = process.env.OBSCUR_L3_RELAY_URL?.trim() || "ws://127.0.0.1:7000";
const outJson = path.join(repoRoot, "docs", "handoffs", "r-relay-web-l3-soak-2026-07-30.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "r-relay-web-l3-soak-2026-07-30.md");

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
};

const tcpOpen = (host, port, ms = 2000) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const t = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, ms);
    socket.once("connect", () => {
      clearTimeout(t);
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(t);
      resolve(false);
    });
  });

const main = async () => {
  const dockerUp = await tcpOpen("127.0.0.1", 7000);
  record(
    "product_relay_7000",
    true,
    dockerUp
      ? "listening (Docker parity)"
      : "unreachable — vitest will use ephemeral lab stub",
  );

  const unit = spawnSync(
    "pnpm",
    [
      "-C",
      "apps/pwa",
      "exec",
      "vitest",
      "run",
      "../../packages/obscur-conduit-mesh/src/conduit-mesh-relay-pool-runtime.test.ts",
    ],
    { cwd: repoRoot, encoding: "utf8", shell: true },
  );
  record(
    "mesh_active_escape_unit",
    unit.status === 0,
    unit.status === 0 ? "2 Pass" : (unit.stderr || unit.stdout || "").slice(-400),
  );

  const vitest = spawnSync(
    "pnpm",
    [
      "-C",
      "apps/pwa",
      "exec",
      "vitest",
      "run",
      "../../packages/obscur-conduit-mesh/src/conduit-mesh.web-l3.soak.test.ts",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, OBSCUR_L3_RELAY_URL: RELAY_URL },
    },
  );
  const combined = `${vitest.stdout || ""}\n${vitest.stderr || ""}`;
  const mode = /web-L3 mode=docker_7000/.test(combined) || /listening \(Docker parity\)/.test(
    results.find((r) => r.name === "product_relay_7000")?.detail || "",
  )
    ? "docker_7000"
    : /ephemeral lab relay|web-L3 mode=ephemeral_lab|unreachable — vitest will use ephemeral/.test(
        combined + (results.find((r) => r.name === "product_relay_7000")?.detail || ""),
      )
      ? "ephemeral_lab"
      : "unknown";
  // Prefer docker when TCP probe was up this run.
  const resolvedMode = dockerUp ? "docker_7000" : mode === "unknown" ? "ephemeral_lab" : mode;
  const meshPass = vitest.status === 0 && /Test Files\s+1 passed/.test(combined);
  record(
    "vitest_web_mesh_pool",
    meshPass,
    meshPass
      ? `mode=${resolvedMode} · configure→publish EVENT/OK · damus escape rejected`
      : `status=${vitest.status} tail=${combined.slice(-700).replace(/\s+/g, " ")}`,
  );

  const pass = results.every((r) => r.ok);
  const payload = {
    at: new Date().toISOString(),
    preferredRelayUrl: RELAY_URL,
    dockerRelayUp: dockerUp,
    mode: resolvedMode,
    results,
    pass,
    recipe: "node scripts/l3-mesh-web-soak.mjs",
    claim: {
      maySay: dockerUp
        ? "Web/TS local mesh path fixed (lab · Docker :7000)"
        : "Web/TS local mesh path fixed (lab · ephemeral stub; Docker optional for parity)",
      mustNotSay: ["public Nostr fixed"],
    },
  };
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const md = `# Optional web L3 soak — TS conduit mesh

- **When:** ${payload.at}
- **Outcome:** ${pass ? "**Pass**" : "**Fail**"}
- **Mode:** \`${resolvedMode}\` · Docker \`:7000\` ${dockerUp ? "up" : "down (ephemeral stub)"}
- **Recipe:** \`${payload.recipe}\`

## Checks

${results.map((r) => `- [${r.ok ? "x" : " "}] **${r.name}** — ${r.detail || (r.ok ? "Pass" : "Fail")}`).join("\n")}

## Claim

| May say | When |
|---------|------|
| Web/TS local mesh path fixed (L3 lab) | This soak Pass |
| Public Nostr / transport “fixed” | **No** |
| Docker parity | Only when mode=\`docker_7000\` |

JSON: [\`r-relay-web-l3-soak-2026-07-30.json\`](./r-relay-web-l3-soak-2026-07-30.json)
`;
  fs.writeFileSync(outMd, md, "utf8");
  console.log("");
  console.log(pass ? "Web L3 soak PASS" : "Web L3 soak FAIL");
  console.log(`Wrote ${outMd}`);
  process.exit(pass ? 0 : 1);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
