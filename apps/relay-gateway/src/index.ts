import { WebSocketServer, WebSocket } from "ws";
import {
  CommunityRelayHideRegistry,
  filterCommunityRelayWireMessage,
  recordCommunityHidePublishPayload,
} from "./community-relay-hide-suppress";
import {
  hydrateHideRegistry,
  loadHideRegistrySnapshot,
  saveHideRegistrySnapshot,
} from "./community-relay-hide-registry-persist";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 7001;
const UPSTREAM_URL = process.env.UPSTREAM_URL || "ws://localhost:7000";
const MIN_POW_DIFFICULTY = 12;
const HIDE_SUPPRESS_ENABLED = process.env.OBSCUR_RELAY_HIDE_SUPPRESS !== "0";
const HIDE_REGISTRY_PATH = process.env.OBSCUR_RELAY_HIDE_REGISTRY_PATH
  ?? "apps/relay-gateway/data/hide-registry.json";
const PERSIST_HIDE_REGISTRY = process.env.OBSCUR_RELAY_HIDE_PERSIST !== "0";

console.log(`[Relay Gateway] Starting on port ${PORT}...`);
console.log(`[Relay Gateway] Upstream: ${UPSTREAM_URL}`);
console.log(`[Relay Gateway] Min PoW Difficulty for K0: ${MIN_POW_DIFFICULTY}`);
console.log(`[Relay Gateway] Community hide suppress (D1): ${HIDE_SUPPRESS_ENABLED ? "on" : "off"}`);
console.log(`[Relay Gateway] Hide registry persist (D2): ${PERSIST_HIDE_REGISTRY ? HIDE_REGISTRY_PATH : "off"}`);

const wss = new WebSocketServer({ port: PORT });

const globalHideRegistry = HIDE_SUPPRESS_ENABLED ? new CommunityRelayHideRegistry() : null;
if (globalHideRegistry && PERSIST_HIDE_REGISTRY) {
  const snapshot = loadHideRegistrySnapshot(HIDE_REGISTRY_PATH);
  hydrateHideRegistry(globalHideRegistry, snapshot);
  console.log(`[Relay Gateway] Loaded ${snapshot.size} hidden id(s) from registry`);
}

const persistHideRegistry = (): void => {
  if (!globalHideRegistry || !PERSIST_HIDE_REGISTRY) {
    return;
  }
  saveHideRegistrySnapshot(
    HIDE_REGISTRY_PATH,
    new Set(globalHideRegistry.listHiddenEventIds()),
  );
};

const recordHideOnGlobalRegistry = (payload: string): void => {
  if (!globalHideRegistry) {
    return;
  }
  const before = globalHideRegistry.listHiddenEventIds().length;
  recordCommunityHidePublishPayload(payload, globalHideRegistry);
  if (globalHideRegistry.listHiddenEventIds().length > before) {
    persistHideRegistry();
  }
};

/**
 * Calculates PoW difficulty from an event ID (hex string)
 */
function getDifficulty(id: string): number {
  let difficulty = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id[i];
    if (!char) break;
    const nibble = parseInt(char, 16);
    if (nibble === 0) {
      difficulty += 4;
    } else {
      difficulty += Math.clz32(nibble) - 28;
      break;
    }
  }
  return difficulty;
}

wss.on("connection", (clientWs) => {
  console.log("[Relay Gateway] Client connected");

  const upstreamWs = new WebSocket(UPSTREAM_URL);

  let isUpstreamOpen = false;
  const pendingMessages: string[] = [];

  const forwardToClient = (raw: string): void => {
    if (clientWs.readyState !== WebSocket.OPEN) {
      return;
    }
    if (!globalHideRegistry) {
      clientWs.send(raw);
      return;
    }
    const filtered = filterCommunityRelayWireMessage(raw, globalHideRegistry);
    if (filtered !== null) {
      clientWs.send(filtered);
    }
  };

  upstreamWs.on("open", () => {
    isUpstreamOpen = true;
    console.log("[Relay Gateway] Connected to upstream relay");
    while (pendingMessages.length > 0) {
      const msg = pendingMessages.shift();
      if (msg) upstreamWs.send(msg);
    }
  });

  upstreamWs.on("message", (data) => {
    forwardToClient(data.toString());
  });

  upstreamWs.on("close", () => {
    console.log("[Relay Gateway] Upstream closed connection");
    clientWs.close();
  });

  upstreamWs.on("error", (err) => {
    console.error("[Relay Gateway] Upstream error:", err);
    clientWs.close();
  });

  clientWs.on("message", (data) => {
    try {
      const raw = data.toString();
      const message = JSON.parse(raw);

      if (Array.isArray(message) && message[0] === "EVENT") {
        const event = message[1];

        recordHideOnGlobalRegistry(raw);

        if (event.kind === 0) {
          const difficulty = getDifficulty(event.id);
          const nonceTag = event.tags.find((t: string[]) => t[0] === "nonce");

          if (!nonceTag || difficulty < MIN_POW_DIFFICULTY) {
            console.warn(`[Relay Gateway] REJECTED kind 0 from ${event.pubkey.slice(0, 8)}: Insufficient PoW (${difficulty}/${MIN_POW_DIFFICULTY})`);
            clientWs.send(JSON.stringify([
              "OK",
              event.id,
              false,
              `pow: insufficient proof of work (difficulty ${difficulty}, required ${MIN_POW_DIFFICULTY})`,
            ]));
            return;
          }

          console.info(`[Relay Gateway] ACCEPTED kind 0 from ${event.pubkey.slice(0, 8)}: PoW difficulty ${difficulty}`);
        }
      }

      if (isUpstreamOpen) {
        upstreamWs.send(raw);
      } else {
        pendingMessages.push(raw);
      }
    } catch (e) {
      console.error("[Relay Gateway] Error parsing client message:", e);
    }
  });

  clientWs.on("close", () => {
    console.log("[Relay Gateway] Client disconnected");
    upstreamWs.close();
  });

  clientWs.on("error", (err) => {
    console.error("[Relay Gateway] Client error:", err);
    upstreamWs.close();
  });
});
