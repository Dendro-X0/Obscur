import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createRelayWebSocket } from "./create-relay-websocket";
import type { RelayConnection } from "./relay-connection";
import type { RelayConnectionStatus } from "./relay-connection-status";

type RelayPoolState = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
}>;

type RelayPoolResult = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
}>;

type RelayStatusByUrl = Readonly<Record<string, RelayConnection>>;

type SocketByUrl = Readonly<Record<string, WebSocket>>;

type MessageListener = (params: Readonly<{ url: string; message: string }>) => void;

type Unsubscribe = () => void;

const getUnixMs = (): number => Date.now();

const createNextConnection = (params: Readonly<{ url: string; status: RelayConnectionStatus; errorMessage?: string }>): RelayConnection => ({
  url: params.url,
  status: params.status,
  updatedAtUnixMs: getUnixMs(),
  errorMessage: params.errorMessage
});

const upsertConnection = (current: RelayStatusByUrl, next: RelayConnection): RelayStatusByUrl => ({
  ...current,
  [next.url]: next
});

let relayUrlsKey: string = "";
let statusByUrl: RelayStatusByUrl = {};
let socketsByUrl: SocketByUrl = {};
const listeners: Set<() => void> = new Set();
const messageListeners: Set<MessageListener> = new Set();

let cachedSnapshot: RelayPoolState = { connections: [] };

let notifyScheduled: boolean = false;

const notifyListeners = (): void => {
  if (notifyScheduled) {
    return;
  }
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    listeners.forEach((listener: () => void) => listener());
  });
};

const notifyMessageListeners = (params: Readonly<{ url: string; message: string }>): void => {
  messageListeners.forEach((listener: MessageListener) => listener(params));
};

const recomputeSnapshot = (): void => {
  const urls: ReadonlyArray<string> = relayUrlsKey ? relayUrlsKey.split("|") : [];
  const connections: ReadonlyArray<RelayConnection> = urls.map((url: string) => {
    const known: RelayConnection | undefined = statusByUrl[url];
    if (known) {
      return known;
    }
    return { url, status: "connecting", updatedAtUnixMs: 0 };
  });
  cachedSnapshot = { connections };
};

const getStateSnapshot = (): RelayPoolState => {
  return cachedSnapshot;
};

const subscribe = (listener: () => void): Unsubscribe => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const setRelayUrls = (urls: ReadonlyArray<string>): void => {
  const nextKey: string = urls.join("|");
  if (nextKey === relayUrlsKey) {
    return;
  }
  relayUrlsKey = nextKey;
  const existingSockets: SocketByUrl = socketsByUrl;
  const nextSockets: Record<string, WebSocket> = {};
  urls.forEach((url: string) => {
    const existing: WebSocket | undefined = existingSockets[url];
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      nextSockets[url] = existing;
      return;
    }
    const socket: WebSocket = createRelayWebSocket(url);
    nextSockets[url] = socket;
    socket.addEventListener("open", () => {
      statusByUrl = upsertConnection(statusByUrl, createNextConnection({ url, status: "open" }));
      recomputeSnapshot();
      notifyListeners();
    });
    socket.addEventListener("error", () => {
      statusByUrl = upsertConnection(statusByUrl, createNextConnection({ url, status: "error", errorMessage: "WebSocket error" }));
      recomputeSnapshot();
      notifyListeners();
    });
    socket.addEventListener("close", () => {
      statusByUrl = upsertConnection(statusByUrl, createNextConnection({ url, status: "closed" }));
      recomputeSnapshot();
      notifyListeners();
    });
    socket.addEventListener("message", (evt: MessageEvent) => {
      if (typeof evt.data !== "string") {
        return;
      }
      notifyMessageListeners({ url, message: evt.data });
    });
  });
  Object.entries(existingSockets).forEach(([url, socket]: [string, WebSocket]) => {
    if (!nextSockets[url] && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      socket.close();
    }
  });
  socketsByUrl = nextSockets;
  recomputeSnapshot();
  notifyListeners();
};

const sendToOpen = (payload: string): void => {
  Object.values(socketsByUrl).forEach((socket: WebSocket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  });
};

const subscribeToMessages = (handler: MessageListener): Unsubscribe => {
  messageListeners.add(handler);
  return () => {
    messageListeners.delete(handler);
  };
};

const serverSnapshot: RelayPoolState = { connections: [] };

export const useRelayPool = (urls: ReadonlyArray<string>): RelayPoolResult => {
  const urlsKey: string = urls.join("|");
  const urlsFromKey: ReadonlyArray<string> = useMemo(() => (urlsKey ? urlsKey.split("|") : []), [urlsKey]);
  useEffect(() => {
    setRelayUrls(urlsFromKey);
  }, [urlsKey, urlsFromKey]);
  const snapshot: RelayPoolState = useSyncExternalStore(subscribe, getStateSnapshot, () => serverSnapshot);
  return { connections: snapshot.connections, sendToOpen, subscribeToMessages };
};
