#!/usr/bin/env node
/**
 * R-RELAY-RUST-6c L3 — offline sneakernet (two data roots).
 *
 * Runs cargo test `l3_offline_sneakernet_two_data_roots` and writes evidence.
 *
 * Usage: node scripts/l3-mesh-offline-sneakernet.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = path.join(repoRoot, "apps", "desktop", "src-tauri");
const outJson = path.join(
  repoRoot,
  "docs",
  "handoffs",
  "r-relay-rust-l3-offline-sneakernet-2026-07-30.json",
);
const outMd = path.join(
  repoRoot,
  "docs",
  "handoffs",
  "r-relay-rust-l3-offline-sneakernet-2026-07-30.md",
);

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
};

const cargo = spawnSync(
  "cargo",
  ["test", "l3_offline_sneakernet_two_data_roots", "--", "--nocapture"],
  {
    cwd: tauriDir,
    encoding: "utf8",
    shell: false,
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  },
);

const combined = `${cargo.stdout || ""}\n${cargo.stderr || ""}`;
const testPass =
  cargo.status === 0
  && /test mesh::l3_offline_sneakernet::l3_offline_sneakernet_two_data_roots \.\.\. ok/.test(
    combined,
  );

record(
  "cargo_l3_offline_sneakernet",
  testPass,
  testPass
    ? "export→copy→import→dm visible · wrong-profile reject"
    : `status=${cargo.status} tail=${combined.slice(-800).replace(/\s+/g, " ")}`,
);

const payload = {
  at: new Date().toISOString(),
  results,
  pass: results.every((r) => r.ok),
  recipe: "node scripts/l3-mesh-offline-sneakernet.mjs",
  claim: {
    maySay: "Offline path fixed (lab sneakernet)",
    mustNotSay: ["air-gap product complete", "BLE ready"],
  },
};

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const md = `# R-RELAY-RUST-6c L3 offline sneakernet

- **When:** ${payload.at}
- **Outcome:** ${payload.pass ? "**Pass**" : "**Fail**"}
- **Recipe:** \`${payload.recipe}\`

## Checks

${results.map((r) => `- [${r.ok ? "x" : " "}] **${r.name}** — ${r.detail || (r.ok ? "Pass" : "Fail")}`).join("\n")}

## Claim

| May say | When |
|---------|------|
| Offline path fixed (L3 lab) | This soak Pass |
| Air-gap product complete | Never from file MVP alone |

JSON: [\`r-relay-rust-l3-offline-sneakernet-2026-07-30.json\`](./r-relay-rust-l3-offline-sneakernet-2026-07-30.json)
`;

fs.writeFileSync(outMd, md, "utf8");
console.log("");
console.log(payload.pass ? "L3 offline sneakernet PASS" : "L3 offline sneakernet FAIL");
console.log(`Wrote ${outMd}`);
process.exit(payload.pass ? 0 : 1);
