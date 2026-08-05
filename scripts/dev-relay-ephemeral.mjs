#!/usr/bin/env node
/**
 * Ephemeral NIP-01 WebSocket relay for local L3 when Docker is unavailable.
 * Listens on ws://127.0.0.1:7000 — EVENT → OK true; REQ → stored events + EOSE.
 * Not for production. Prefer `pnpm dev:relay:docker` when Docker works.
 *
 * Usage: node scripts/dev-relay-ephemeral.mjs
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(repoRoot, "apps/relay-gateway/package.json"));
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.OBSCUR_EPHEMERAL_RELAY_PORT || 7000);
const events = [];

const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });

wss.on("listening", () => {
  console.log(`[dev-relay-ephemeral] listening ws://127.0.0.1:${PORT}`);
});

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!Array.isArray(msg) || msg.length < 2) {
      return;
    }
    const type = msg[0];
    if (type === "EVENT") {
      const event = msg[1];
      const id = typeof event?.id === "string" ? event.id : "";
      if (id) {
        events.push(event);
        if (events.length > 500) {
          events.shift();
        }
      }
      socket.send(JSON.stringify(["OK", id || "unknown", true, ""]));
      return;
    }
    if (type === "REQ") {
      const subId = String(msg[1] ?? "sub");
      for (const event of events) {
        socket.send(JSON.stringify(["EVENT", subId, event]));
      }
      socket.send(JSON.stringify(["EOSE", subId]));
      return;
    }
    if (type === "CLOSE") {
      return;
    }
  });
});

wss.on("error", (err) => {
  console.error("[dev-relay-ephemeral] error", err);
  process.exit(1);
});
