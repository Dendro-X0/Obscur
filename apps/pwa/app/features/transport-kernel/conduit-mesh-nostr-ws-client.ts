import type {
  ConduitMeshNostrConnectionSnapshot,
  ConduitMeshNostrEvent,
  ConduitMeshNostrFilter,
  ConduitMeshNostrSubscriptionPort,
} from "@obscur/conduit-mesh";
import type { NostrWsWirePort } from "@obscur/conduit-mesh";
import { parseNostrWsOkMessage } from "@obscur/conduit-mesh-contracts";

export type ConduitMeshNostrWsClient = NostrWsWirePort & ConduitMeshNostrSubscriptionPort & Readonly<{
  setRelayUrls: (urls: ReadonlyArray<string>) => void;
  subscribeConnections: (listener: () => void) => () => void;
  deliverInboundMessage: (relayUrl: string, message: string) => void;
}>;

export type CreateConduitMeshNostrWsClientParams = Readonly<{
  relayUrls?: ReadonlyArray<string>;
  connectTimeoutMs?: number;
}>;

type RelaySocketState = {
  url: string;
  socket: WebSocket | null;
  status: ConduitMeshNostrConnectionSnapshot["status"];
  errorMessage?: string;
  pendingOkResolvers: Map<string, (message: string) => void>;
};

const isWebSocketRelayUrl = (url: string): boolean => (
  url.startsWith("ws://") || url.startsWith("wss://")
);

const dedupeUrls = (urls: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0)))
);

export const createConduitMeshNostrWsClient = (
  params: CreateConduitMeshNostrWsClientParams = {},
): ConduitMeshNostrWsClient => {
  const connectTimeoutMs = params.connectTimeoutMs ?? 8_000;
  const sockets = new Map<string, RelaySocketState>();
  const messageListeners = new Set<(payload: Readonly<{ url: string; message: string }>) => void>();
  const eventHandlers = new Map<string, (event: ConduitMeshNostrEvent, relayUrl: string) => void>();
  const activeSubscriptions = new Map<string, ReadonlyArray<ConduitMeshNostrFilter>>();
  const connectionListeners = new Set<() => void>();

  let subscriptionCounter = 0;
  let disposed = false;
  /** Cached for useSyncExternalStore — getSnapshot must be referentially stable until notify. */
  let cachedConnectionSnapshots: ReadonlyArray<ConduitMeshNostrConnectionSnapshot> = [];

  const rebuildConnectionSnapshots = (): void => {
    const now = Date.now();
    cachedConnectionSnapshots = Array.from(sockets.values()).map((entry) => ({
      url: entry.url,
      status: entry.status,
      updatedAtUnixMs: now,
      errorMessage: entry.errorMessage,
    }));
  };

  const notifyConnectionListeners = (): void => {
    rebuildConnectionSnapshots();
    for (const listener of connectionListeners) {
      listener();
    }
  };

  const getConnectionSnapshots = (): ReadonlyArray<ConduitMeshNostrConnectionSnapshot> => (
    cachedConnectionSnapshots
  );

  const dispatchMessage = (relayUrl: string, message: string): void => {
    for (const listener of messageListeners) {
      listener({ url: relayUrl, message });
    }

    try {
      const parsed = JSON.parse(message) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }

      if (parsed[0] === "OK") {
        const eventId = typeof parsed[1] === "string" ? parsed[1] : undefined;
        const entry = sockets.get(relayUrl);
        if (entry && eventId) {
          const resolver = entry.pendingOkResolvers.get(eventId);
          if (resolver) {
            resolver(message);
            entry.pendingOkResolvers.delete(eventId);
          }
        }
        return;
      }

      if (parsed[0] !== "EVENT") {
        return;
      }

      const event = parsed[1] as ConduitMeshNostrEvent;
      for (const [subId, filters] of activeSubscriptions) {
        const handler = eventHandlers.get(subId);
        if (!handler) {
          continue;
        }
        if (matchesFilters(event, filters)) {
          handler(event, relayUrl);
        }
      }
    } catch {
      // ignore malformed relay messages
    }
  };

  const closeSocket = (url: string): void => {
    const entry = sockets.get(url);
    if (!entry?.socket) {
      return;
    }
    try {
      entry.socket.close();
    } catch {
      // ignore close errors
    }
  };

  const connectRelay = (url: string): void => {
    if (!isWebSocketRelayUrl(url) || typeof WebSocket === "undefined") {
      return;
    }

    closeSocket(url);

    const entry: RelaySocketState = {
      url,
      socket: null,
      status: "connecting",
      pendingOkResolvers: new Map(),
    };
    sockets.set(url, entry);
    notifyConnectionListeners();

    const socket = new WebSocket(url);
    entry.socket = socket;

    const connectTimeoutId = setTimeout(() => {
      if (entry.status === "connecting") {
        entry.status = "error";
        entry.errorMessage = "connect_timeout";
        notifyConnectionListeners();
        try {
          socket.close();
        } catch {
          // ignore
        }
      }
    }, connectTimeoutMs);

    socket.onopen = () => {
      clearTimeout(connectTimeoutId);
      entry.status = "open";
      entry.errorMessage = undefined;
      notifyConnectionListeners();
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      dispatchMessage(url, event.data);
    };

    socket.onerror = () => {
      entry.status = "error";
      entry.errorMessage = "websocket_error";
      notifyConnectionListeners();
    };

    socket.onclose = () => {
      clearTimeout(connectTimeoutId);
      entry.status = "closed";
      notifyConnectionListeners();
    };
  };

  const setRelayUrls = (urls: ReadonlyArray<string>): void => {
    const normalized = dedupeUrls(urls).filter(isWebSocketRelayUrl);
    const nextSet = new Set(normalized);

    for (const existingUrl of sockets.keys()) {
      if (!nextSet.has(existingUrl)) {
        closeSocket(existingUrl);
        sockets.delete(existingUrl);
      }
    }

    for (const url of normalized) {
      const existing = sockets.get(url);
      if (!existing || existing.status === "closed" || existing.status === "error") {
        connectRelay(url);
      }
    }

    notifyConnectionListeners();
  };

  const sendToRelay = (relayUrl: string, payload: string): boolean => {
    const entry = sockets.get(relayUrl);
    if (!entry?.socket || entry.status !== "open") {
      return false;
    }
    try {
      entry.socket.send(payload);
      return true;
    } catch {
      return false;
    }
  };

  const waitForOk = (relayUrl: string, eventId: string): Promise<string | undefined> => new Promise((resolve) => {
    const entry = sockets.get(relayUrl);
    if (!entry) {
      resolve(undefined);
      return;
    }

    const timeoutId = setTimeout(() => {
      entry.pendingOkResolvers.delete(eventId);
      resolve(undefined);
    }, connectTimeoutMs);

    entry.pendingOkResolvers.set(eventId, (message) => {
      clearTimeout(timeoutId);
      resolve(message);
    });
  });

  if (params.relayUrls && params.relayUrls.length > 0) {
    setRelayUrls(params.relayUrls);
  }

  return {
    setRelayUrls,
    subscribeConnections: (listener) => {
      connectionListeners.add(listener);
      return () => {
        connectionListeners.delete(listener);
      };
    },

    getConnectionSnapshots,

    publish: async (relayUrl, wirePayload) => {
      if (disposed) {
        return {
          accepted: false,
          errorMessage: "client_disposed",
          okMessage: JSON.stringify(["OK", "disposed", false, "client_disposed"]),
        };
      }

      if (!sendToRelay(relayUrl, wirePayload)) {
        return {
          accepted: false,
          errorMessage: "relay_not_connected",
          okMessage: JSON.stringify(["OK", "offline", false, "relay_not_connected"]),
        };
      }

      let eventId = "unknown-event";
      try {
        const parsed = JSON.parse(wirePayload) as unknown;
        if (Array.isArray(parsed) && parsed[0] === "EVENT") {
          const event = parsed[1] as { id?: string };
          if (typeof event?.id === "string") {
            eventId = event.id;
          }
        }
      } catch {
        // ignore parse errors
      }

      const okMessage = await waitForOk(relayUrl, eventId);
      if (!okMessage) {
        return {
          accepted: false,
          eventId,
          errorMessage: "ok_timeout",
          okMessage: JSON.stringify(["OK", eventId, false, "ok_timeout"]),
        };
      }

      const parsedOk = parseNostrWsOkMessage(okMessage);
      return {
        accepted: parsedOk.ok,
        eventId: parsedOk.eventId ?? eventId,
        errorMessage: parsedOk.errorMessage,
        okMessage,
      };
    },

    probe: async (relayUrl) => {
      const entry = sockets.get(relayUrl);
      if (!entry) {
        return { healthy: false, detail: "not_configured" };
      }
      if (entry.status === "open") {
        return { healthy: true };
      }
      return { healthy: false, detail: entry.errorMessage ?? entry.status };
    },

    subscribe: (filters, onEvent) => {
      subscriptionCounter += 1;
      const subId = `mesh-sub-${subscriptionCounter}`;
      activeSubscriptions.set(subId, filters);
      eventHandlers.set(subId, onEvent);

      const reqPayload = JSON.stringify(["REQ", subId, ...filters]);
      for (const entry of sockets.values()) {
        if (entry.status === "open") {
          sendToRelay(entry.url, reqPayload);
        }
      }

      return subId;
    },

    unsubscribe: (subscriptionId) => {
      activeSubscriptions.delete(subscriptionId);
      eventHandlers.delete(subscriptionId);
      const closePayload = JSON.stringify(["CLOSE", subscriptionId]);
      for (const entry of sockets.values()) {
        if (entry.status === "open") {
          sendToRelay(entry.url, closePayload);
        }
      }
    },

    subscribeToMessages: (handler) => {
      messageListeners.add(handler);
      return () => {
        messageListeners.delete(handler);
      };
    },

    deliverInboundMessage: (relayUrl, message) => {
      if (disposed) {
        return;
      }
      dispatchMessage(relayUrl, message);
    },

    sendToOpen: (payload) => {
      for (const entry of sockets.values()) {
        if (entry.status === "open") {
          sendToRelay(entry.url, payload);
        }
      }
    },

    dispose: () => {
      disposed = true;
      for (const url of sockets.keys()) {
        closeSocket(url);
      }
      sockets.clear();
      messageListeners.clear();
      eventHandlers.clear();
      activeSubscriptions.clear();
      connectionListeners.clear();
    },
  };
};

const matchesFilters = (
  event: ConduitMeshNostrEvent,
  filters: ReadonlyArray<ConduitMeshNostrFilter>,
): boolean => {
  if (filters.length === 0) {
    return true;
  }

  const kind = typeof event.kind === "number" ? event.kind : undefined;
  const pubkey = typeof event.pubkey === "string" ? event.pubkey : undefined;
  const tags = Array.isArray(event.tags) ? event.tags as ReadonlyArray<readonly string[]> : [];

  return filters.some((filter) => {
    if (filter.kinds && kind !== undefined && !filter.kinds.includes(kind)) {
      return false;
    }
    if (filter.authors && pubkey && !filter.authors.includes(pubkey)) {
      return false;
    }
    if (filter["#p"]) {
      const pTags = tags.filter((tag) => tag[0] === "p").map((tag) => tag[1]).filter(Boolean);
      if (!filter["#p"].some((value) => pTags.includes(value))) {
        return false;
      }
    }
    return true;
  });
};
