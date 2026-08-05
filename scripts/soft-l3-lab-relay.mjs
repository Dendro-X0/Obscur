#!/usr/bin/env node
/**
 * Soft L3 lab Nostr relay (NIP-01 subset) — Docker-free fallback for ws://localhost:7000.
 *
 * Usage: node scripts/soft-l3-lab-relay.mjs
 * Env:   OBSCUR_LAB_RELAY_PORT=7000
 *
 * @see specs/backend/soft-l3-lab-relay-without-docker-2026-08.md
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromGateway = createRequire(path.join(repoRoot, "apps", "relay-gateway", "package.json"));
const { WebSocketServer } = requireFromGateway("ws");

const PORT = Number.parseInt(process.env.OBSCUR_LAB_RELAY_PORT ?? "7000", 10);
const MAX_EVENTS = 5_000;

/** @type {Map<string, object>} */
const eventsById = new Map();
/** @type {Array<object>} */
const eventOrder = [];
/** @type {Map<import("ws").WebSocket, Map<string, object[]>>} */
const subscriptions = new Map();

const log = (message) => console.log(`[soft-l3-lab-relay] ${message}`);

const matchesFilter = (event, filter) => {
  if (!filter || typeof filter !== "object") return true;
  if (Array.isArray(filter.ids) && filter.ids.length > 0 && !filter.ids.includes(event.id)) {
    return false;
  }
  if (Array.isArray(filter.authors) && filter.authors.length > 0 && !filter.authors.includes(event.pubkey)) {
    return false;
  }
  if (Array.isArray(filter.kinds) && filter.kinds.length > 0 && !filter.kinds.includes(event.kind)) {
    return false;
  }
  if (typeof filter.since === "number" && event.created_at < filter.since) {
    return false;
  }
  if (typeof filter.until === "number" && event.created_at > filter.until) {
    return false;
  }
  for (const [key, values] of Object.entries(filter)) {
    if (!key.startsWith("#") || !Array.isArray(values) || values.length === 0) continue;
    const tagName = key.slice(1);
    const tagValues = (event.tags ?? [])
      .filter((tag) => Array.isArray(tag) && tag[0] === tagName)
      .map((tag) => tag[1])
      .filter(Boolean);
    if (!values.some((value) => tagValues.includes(value))) {
      return false;
    }
  }
  return true;
};

const storeEvent = (event) => {
  if (!event?.id || eventsById.has(event.id)) {
    return { stored: false, duplicate: Boolean(event?.id && eventsById.has(event.id)) };
  }
  eventsById.set(event.id, event);
  eventOrder.push(event);
  while (eventOrder.length > MAX_EVENTS) {
    const oldest = eventOrder.shift();
    if (oldest?.id) eventsById.delete(oldest.id);
  }
  return { stored: true, duplicate: false };
};

const broadcastEvent = (event) => {
  for (const [socket, subs] of subscriptions.entries()) {
    if (socket.readyState !== 1) continue;
    for (const [subId, filters] of subs.entries()) {
      if (filters.some((filter) => matchesFilter(event, filter))) {
        socket.send(JSON.stringify(["EVENT", subId, event]));
      }
    }
  }
};

const httpServer = createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/")) {
    res.writeHead(200, {
      "content-type": "application/nostr+json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Accept",
    });
    res.end(JSON.stringify({
      name: "obscur-soft-l3-lab-relay",
      description: "Docker-free Soft L3 lab relay (NIP-01 subset)",
      supported_nips: [1, 11],
      software: "obscur/scripts/soft-l3-lab-relay.mjs",
    }));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (socket) => {
  subscriptions.set(socket, new Map());
  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      socket.send(JSON.stringify(["NOTICE", "invalid_json"]));
      return;
    }
    if (!Array.isArray(message) || message.length === 0) {
      socket.send(JSON.stringify(["NOTICE", "invalid_frame"]));
      return;
    }
    const type = message[0];
    if (type === "EVENT") {
      const event = message[1];
      if (!event?.id || typeof event.kind !== "number") {
        socket.send(JSON.stringify(["OK", event?.id ?? "", false, "invalid: bad event"]));
        return;
      }
      const result = storeEvent(event);
      socket.send(JSON.stringify([
        "OK",
        event.id,
        true,
        result.duplicate ? "duplicate: already have this event" : "",
      ]));
      if (result.stored) {
        broadcastEvent(event);
      }
      return;
    }
    if (type === "REQ") {
      const subId = String(message[1] ?? "");
      const filters = message.slice(2);
      if (!subId) {
        socket.send(JSON.stringify(["NOTICE", "invalid: empty subscription id"]));
        return;
      }
      subscriptions.get(socket)?.set(subId, filters);
      for (const event of eventOrder) {
        if (filters.some((filter) => matchesFilter(event, filter))) {
          socket.send(JSON.stringify(["EVENT", subId, event]));
        }
      }
      socket.send(JSON.stringify(["EOSE", subId]));
      return;
    }
    if (type === "CLOSE") {
      const subId = String(message[1] ?? "");
      subscriptions.get(socket)?.delete(subId);
      return;
    }
    socket.send(JSON.stringify(["NOTICE", `unsupported:${String(type)}`]));
  });
  socket.on("close", () => {
    subscriptions.delete(socket);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  log(`listening ws://localhost:${PORT} (NIP-01 lab Soft L3)`);
});
