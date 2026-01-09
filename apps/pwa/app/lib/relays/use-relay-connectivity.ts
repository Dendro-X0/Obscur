import { useEffect, useMemo, useState } from "react";
import type { RelayConnection } from "./relay-connection";
import type { RelayConnectionStatus } from "./relay-connection-status";
import { createRelayWebSocket } from "./create-relay-websocket";

type RelayConnectivityState = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
}>;

const getUnixMs = (): number => Date.now();

type RelayStatusByUrl = Readonly<Record<string, RelayConnection>>;

const createNextConnection = (params: Readonly<{
  url: string;
  status: RelayConnectionStatus;
  errorMessage?: string;
}>): RelayConnection => ({
  url: params.url,
  status: params.status,
  updatedAtUnixMs: getUnixMs(),
  errorMessage: params.errorMessage
});

const upsertConnection = (
  current: RelayStatusByUrl,
  next: RelayConnection
): RelayStatusByUrl => ({
  ...current,
  [next.url]: next
});

export const useRelayConnectivity = (relayUrls: ReadonlyArray<string>): RelayConnectivityState => {
  const relayUrlsKey: string = relayUrls.join("|");
  const [statusByUrl, setStatusByUrl] = useState<RelayStatusByUrl>({});
  const stableRelayUrls: ReadonlyArray<string> = useMemo(() => relayUrls, [relayUrls]);
  const connections: ReadonlyArray<RelayConnection> = stableRelayUrls.map((url: string) => {
    const known: RelayConnection | undefined = statusByUrl[url];
    if (known) {
      return known;
    }
    return {
      url,
      status: "connecting",
      updatedAtUnixMs: 0
    };
  });
  useEffect(() => {
    const sockets: Array<Readonly<{ url: string; socket: WebSocket }>> = [];
    stableRelayUrls.forEach((url: string) => {
      const socket: WebSocket = createRelayWebSocket(url);
      sockets.push({ url, socket });
      socket.addEventListener("open", () => {
        setStatusByUrl((prev: RelayStatusByUrl) => upsertConnection(prev, createNextConnection({ url, status: "open" })));
      });
      socket.addEventListener("error", () => {
        setStatusByUrl((prev: RelayStatusByUrl) =>
          upsertConnection(prev, createNextConnection({ url, status: "error", errorMessage: "WebSocket error" }))
        );
      });
      socket.addEventListener("close", () => {
        setStatusByUrl((prev: RelayStatusByUrl) => upsertConnection(prev, createNextConnection({ url, status: "closed" })));
      });
    });
    return () => {
      sockets.forEach((item) => {
        if (item.socket.readyState === WebSocket.OPEN || item.socket.readyState === WebSocket.CONNECTING) {
          item.socket.close();
        }
      });
    };
  }, [relayUrlsKey, stableRelayUrls]);
  return { connections };
};
