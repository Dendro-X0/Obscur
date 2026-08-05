/**
 * Minimal Nostr EVENT→OK WebSocket stub for web L3 when Docker `:7000` is down.
 * Not a product relay — lab-only.
 */

import { createRequire } from "node:module";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type EphemeralNostrRelay = Readonly<{
  url: string;
  close: () => Promise<void>;
}>;

const requireFromGateway = createRequire(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../apps/relay-gateway/package.json",
  ),
);

export const startEphemeralNostrRelay = async (): Promise<EphemeralNostrRelay> => {
  const { WebSocketServer } = requireFromGateway("ws") as {
    WebSocketServer: new (options: { server: ReturnType<typeof createServer> }) => {
      on: (event: "connection", cb: (socket: {
        on: (event: "message", cb: (data: unknown) => void) => void;
        send: (data: string) => void;
      }) => void) => void;
      close: (cb?: () => void) => void;
    };
  };

  const server = createServer();
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket) => {
    socket.on("message", (data) => {
      const raw = String(data);
      try {
        const frame = JSON.parse(raw) as unknown;
        if (!Array.isArray(frame) || frame[0] !== "EVENT") {
          return;
        }
        const event = frame[1] as { id?: string };
        const eventId = typeof event?.id === "string" ? event.id : "unknown";
        socket.send(JSON.stringify(["OK", eventId, true, ""]));
      } catch {
        // ignore
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("ephemeral_relay_bind_failed");
  }

  return {
    url: `ws://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve) => {
        wss.close(() => {
          server.close(() => resolve());
        });
      });
    },
  };
};
