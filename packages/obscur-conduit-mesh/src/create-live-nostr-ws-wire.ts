/**
 * Live NostrWsWirePort for headless/web L3 soaks (Node WebSocket / `ws` polyfill).
 * Product browser path uses `createConduitMeshNostrWsClient` + createRelayWebSocket.
 * @see specs/backend/r-relay-web-l3-soak-design-2026-07.md
 */

import { extractEventIdFromNostrWirePayload, parseNostrWsOkMessage } from "@obscur/conduit-mesh-contracts";

import type { NostrWsWirePort, NostrWsWirePublishResult } from "./nostr-ws-wire-port";

export type CreateLiveNostrWsWireParams = Readonly<{
  connectTimeoutMs?: number;
  /** Inject WebSocket ctor (Node global, `ws`, or test mock). */
  WebSocketImpl?: typeof WebSocket;
}>;

const openSocket = (
  WebSocketImpl: typeof WebSocket,
  url: string,
  timeoutMs: number,
): Promise<WebSocket> => (
  new Promise((resolve, reject) => {
    const socket = new WebSocketImpl(url);
    const timer = setTimeout(() => {
      try {
        socket.close();
      } catch {
        // ignore
      }
      reject(new Error("connect_timeout"));
    }, timeoutMs);

    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("websocket_error"));
    });
  })
);

const waitOk = (
  socket: WebSocket,
  eventId: string,
  timeoutMs: number,
): Promise<string | undefined> => (
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.removeEventListener("message", onMessage);
      resolve(undefined);
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      const raw = typeof event.data === "string" ? event.data : String(event.data);
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed[0] === "OK" && parsed[1] === eventId) {
          clearTimeout(timer);
          socket.removeEventListener("message", onMessage);
          resolve(raw);
        }
      } catch {
        // ignore
      }
    };

    socket.addEventListener("message", onMessage);
  })
);

/**
 * One-shot connect → publish → await OK → close (lab soak friendly).
 */
export const createLiveNostrWsWire = (
  params: CreateLiveNostrWsWireParams = {},
): NostrWsWirePort => {
  const connectTimeoutMs = params.connectTimeoutMs ?? 8_000;
  const WebSocketImpl = params.WebSocketImpl
    ?? (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;

  if (!WebSocketImpl) {
    throw new Error("WebSocket_unavailable");
  }

  return {
    publish: async (relayUrl, wirePayload): Promise<NostrWsWirePublishResult> => {
      const eventId = extractEventIdFromNostrWirePayload(wirePayload) ?? "unknown-event";
      let socket: WebSocket | undefined;
      try {
        socket = await openSocket(WebSocketImpl, relayUrl, connectTimeoutMs);
        const okPromise = waitOk(socket, eventId, connectTimeoutMs);
        socket.send(wirePayload);
        const okMessage = await okPromise;
        if (!okMessage) {
          return {
            accepted: false,
            eventId,
            errorMessage: "ok_timeout",
            okMessage: JSON.stringify(["OK", eventId, false, "ok_timeout"]),
          };
        }
        const parsed = parseNostrWsOkMessage(okMessage);
        return {
          accepted: parsed.ok,
          eventId: parsed.eventId ?? eventId,
          errorMessage: parsed.errorMessage,
          okMessage,
        };
      } catch (error) {
        return {
          accepted: false,
          eventId,
          errorMessage: error instanceof Error ? error.message : String(error),
          okMessage: JSON.stringify(["OK", eventId, false, "publish_failed"]),
        };
      } finally {
        try {
          socket?.close();
        } catch {
          // ignore
        }
      }
    },

    probe: async (relayUrl) => {
      let socket: WebSocket | undefined;
      try {
        socket = await openSocket(WebSocketImpl, relayUrl, connectTimeoutMs);
        return { healthy: true };
      } catch (error) {
        return {
          healthy: false,
          detail: error instanceof Error ? error.message : String(error),
        };
      } finally {
        try {
          socket?.close();
        } catch {
          // ignore
        }
      }
    },
  };
};
