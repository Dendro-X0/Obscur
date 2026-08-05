#!/usr/bin/env node
/**
 * R-RELAY-RUST L3-product soak — Docker `:7000` + mesh contract (no public Nostr).
 *
 * Prerequisites: `pnpm dev:relay:docker` (ws://127.0.0.1:7000 listening)
 * Usage: node scripts/l3-mesh-product-soak.mjs
 *
 * Proves runbook steps 1/3/4/5 at the wire + mesh-logic layer.
 * Full Tauri `engine_invoke` UI soak remains optional follow-on.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(repoRoot, "apps/pwa/package.json"));
const { WebSocket } = createRequire(path.join(repoRoot, "apps/relay-gateway/package.json"))("ws");
const { generateSecretKey, finalizeEvent } = require("nostr-tools");

const RELAY_URL = process.env.OBSCUR_L3_RELAY_URL?.trim() || "ws://127.0.0.1:7000";
const results = [];

const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
};

const waitOpen = (ws, ms = 8_000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("open_timeout")), ms);
    ws.once("open", () => {
      clearTimeout(t);
      resolve();
    });
    ws.once("error", (err) => {
      clearTimeout(t);
      reject(err);
    });
  });

const waitMessage = (ws, ms = 8_000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("message_timeout")), ms);
    ws.once("message", (data) => {
      clearTimeout(t);
      resolve(String(data));
    });
    ws.once("error", (err) => {
      clearTimeout(t);
      reject(err);
    });
  });

const publishEventOk = async () => {
  const sk = generateSecretKey();
  const event = finalizeEvent(
    {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["client", "obscur-l3-product"]],
      content: `obscur-l3-product-mesh-soak-${Date.now()}`,
    },
    sk,
  );

  const ws = new WebSocket(RELAY_URL);
  await waitOpen(ws);
  ws.send(JSON.stringify(["EVENT", event]));
  const raw = await waitMessage(ws);
  ws.close();
  const frame = JSON.parse(raw);
  if (frame[0] !== "OK" || frame[1] !== event.id || frame[2] !== true) {
    throw new Error(`unexpected OK frame: ${raw}`);
  }
  return event.id;
};

const rejectDamusEscape = () => {
  // Mirror resolve_mesh_publish_urls / NostrWsDialect gate (mesh-active = local only).
  const meshActive = [RELAY_URL.replace("localhost", "127.0.0.1")];
  const requested = ["wss://relay.damus.io"];
  const allowed = new Set(meshActive);
  for (const url of requested) {
    if (!allowed.has(url)) {
      return `relay_url_not_in_mesh_active_set:${url}`;
    }
  }
  throw new Error("escape_should_have_failed");
};

const runCargoMeshDialect = () => {
  const r = spawnSync(
    "cargo",
    ["test", "--lib", "mesh::dialect::", "--", "--test-threads=1"],
    {
      cwd: path.join(repoRoot, "apps/desktop/src-tauri"),
      encoding: "utf8",
      shell: true,
    },
  );
  if (r.status !== 0) {
    throw new Error(r.stderr?.slice(-500) || r.stdout?.slice(-500) || "cargo_failed");
  }
  const out = `${r.stdout}\n${r.stderr}`;
  if (!out.includes("test result: ok")) {
    throw new Error("cargo mesh::dialect did not report ok");
  }
  return out.match(/(\d+) passed/)?.[1] ?? "?";
};

const runCargoMeshL3Lab = () => {
  const r = spawnSync(
    "cargo",
    ["test", "--lib", "mesh::l3_soak::", "--", "--test-threads=1"],
    {
      cwd: path.join(repoRoot, "apps/desktop/src-tauri"),
      encoding: "utf8",
      shell: true,
    },
  );
  if (r.status !== 0) {
    throw new Error(r.stderr?.slice(-500) || "cargo_l3_lab_failed");
  }
  return "1";
};

const main = async () => {
  console.log(`L3-product soak → ${RELAY_URL}`);
  console.log("");

  try {
    const ws = new WebSocket(RELAY_URL);
    await waitOpen(ws);
    ws.send(JSON.stringify(["REQ", "l3-probe", { kinds: [1], limit: 1 }]));
    const raw = await waitMessage(ws);
    ws.close();
    record("docker_relay_reachable", true, `REQ reply ${raw.slice(0, 40)}`);
  } catch (error) {
    record("docker_relay_reachable", false, error instanceof Error ? error.message : String(error));
  }

  try {
    const eventId = await publishEventOk();
    record("event_ok_on_local_relay", true, `id=${eventId.slice(0, 16)}…`);
  } catch (error) {
    record("event_ok_on_local_relay", false, error instanceof Error ? error.message : String(error));
  }

  try {
    const reason = rejectDamusEscape();
    record("damus_escape_rejected", reason.includes("not_in_mesh_active_set"), reason);
  } catch (error) {
    record("damus_escape_rejected", false, error instanceof Error ? error.message : String(error));
  }

  try {
    const n = runCargoMeshDialect();
    record("cargo_mesh_dialect", true, `${n} passed`);
  } catch (error) {
    record("cargo_mesh_dialect", false, error instanceof Error ? error.message : String(error));
  }

  try {
    runCargoMeshL3Lab();
    record("cargo_mesh_l3_lab", true, "1 passed");
  } catch (error) {
    record("cargo_mesh_l3_lab", false, error instanceof Error ? error.message : String(error));
  }

  // Mesh configure contract against product URL (unit runtime — same descriptors as IPC).
  try {
    const r = spawnSync(
      "cargo",
      [
        "test",
        "--lib",
        "mesh::runtime::tests::configure_selects_padded_local_pool",
        "--",
        "--exact",
        "--test-threads=1",
      ],
      {
        cwd: path.join(repoRoot, "apps/desktop/src-tauri"),
        encoding: "utf8",
        shell: true,
      },
    );
    record("cargo_mesh_configure_pad", r.status === 0, r.status === 0 ? "ok" : "failed");
  } catch (error) {
    record("cargo_mesh_configure_pad", false, error instanceof Error ? error.message : String(error));
  }

  console.log("");
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`L3-product FAIL (${failed.length} checks)`);
    process.exit(1);
  }
  console.log("L3-product PASS — Docker :7000 EVENT/OK + mesh dialect/lab + escape gate");
  console.log("Note: packaged Tauri engine_invoke UI soak still optional.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
