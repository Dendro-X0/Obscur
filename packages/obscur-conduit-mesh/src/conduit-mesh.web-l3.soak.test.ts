/**
 * Optional web L3 soak — TS conduit mesh ↔ live Nostr WS.
 * Prefers Docker `:7000`; falls back to ephemeral lab stub when unreachable.
 * @see specs/backend/r-relay-web-l3-soak-design-2026-07.md
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { describe, expect, it } from "vitest";

import { createConduitMeshRelayPoolRuntime } from "./conduit-mesh-relay-pool-runtime";
import { createLiveNostrWsWire } from "./create-live-nostr-ws-wire";
import { startEphemeralNostrRelay } from "./ephemeral-nostr-relay";

const PREFERRED_RELAY = process.env.OBSCUR_L3_RELAY_URL?.trim() || "ws://127.0.0.1:7000";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const requireFromPwa = createRequire(path.join(repoRoot, "apps/pwa/package.json"));
const requireFromGateway = createRequire(path.join(repoRoot, "apps/relay-gateway/package.json"));

const tcpOpen = (host: string, port: number, ms = 2000): Promise<boolean> => (
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
  })
);

const resolveWebSocketImpl = (): typeof WebSocket => {
  if (typeof globalThis.WebSocket === "function") {
    return globalThis.WebSocket;
  }
  const { WebSocket } = requireFromGateway("ws") as { WebSocket: typeof WebSocket };
  return WebSocket;
};

describe("conduit-mesh web L3 soak", () => {
  it("publishes signed EVENT via TS mesh pool and rejects damus escape", async () => {
    let relayUrl = PREFERRED_RELAY;
    let ephemeral: Awaited<ReturnType<typeof startEphemeralNostrRelay>> | undefined;
    let mode: "docker_7000" | "ephemeral_lab" = "docker_7000";

    const preferredPort = Number(
      new URL(PREFERRED_RELAY.replace(/^ws/, "http")).port || 7000,
    );
    const preferredHost = new URL(PREFERRED_RELAY.replace(/^ws/, "http")).hostname;
    const dockerUp = await tcpOpen(preferredHost, preferredPort);
    if (!dockerUp) {
      ephemeral = await startEphemeralNostrRelay();
      relayUrl = ephemeral.url;
      mode = "ephemeral_lab";
      console.warn(
        `web-L3: ${PREFERRED_RELAY} unreachable — using ephemeral lab relay ${relayUrl}`,
      );
    }

    try {
      const { generateSecretKey, finalizeEvent } = requireFromPwa("nostr-tools") as {
        generateSecretKey: () => Uint8Array;
        finalizeEvent: (
          template: Record<string, unknown>,
          sk: Uint8Array,
        ) => { id: string };
      };

      const WebSocketImpl = resolveWebSocketImpl();
      const nostrWire = createLiveNostrWsWire({
        WebSocketImpl,
        connectTimeoutMs: 8_000,
      });

      const probe = await nostrWire.probe?.(relayUrl);
      expect(probe?.healthy).toBe(true);

      const runtime = createConduitMeshRelayPoolRuntime({
        profileId: "web-l3",
        nostrWire,
        now: () => Date.now(),
      });

      await runtime.configureUrls([relayUrl]);

      const sk = generateSecretKey();
      const event = finalizeEvent(
        {
          kind: 1,
          created_at: Math.floor(Date.now() / 1000),
          tags: [["client", "obscur-web-l3"], ["mode", mode]],
          content: `obscur-web-l3-soak-${Date.now()}`,
        },
        sk,
      );
      const wirePayload = JSON.stringify(["EVENT", event]);

      const published = await runtime.publishToUrls([relayUrl], wirePayload, {
        quorumRequired: 1,
        profileId: "web-l3",
      });
      expect(published.metQuorum).toBe(true);
      expect(published.successCount).toBe(1);
      expect(published.results[0]?.success).toBe(true);

      const escape = await runtime.publishToUrls(
        ["wss://relay.damus.io"],
        wirePayload,
        { quorumRequired: 1 },
      );
      expect(escape.metQuorum).toBe(false);
      expect(escape.successCount).toBe(0);
      expect(escape.results[0]?.error).toContain("relay_url_not_in_mesh_active_set");

      runtime.dispose();
      console.log(`web-L3 mode=${mode} relay=${relayUrl}`);
    } finally {
      await ephemeral?.close();
    }
  }, 30_000);
});
