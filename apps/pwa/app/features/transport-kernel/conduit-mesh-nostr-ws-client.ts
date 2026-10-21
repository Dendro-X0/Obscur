import type {
  ConduitMeshNostrConnectionSnapshot,
  ConduitMeshNostrEvent,
  ConduitMeshNostrFilter,
  ConduitMeshNostrSubscriptionPort,
} from "@obscur/conduit-mesh";
import type { NostrWsWirePort } from "@obscur/conduit-mesh";
import { parseNostrWsOkMessage } from "@obscur/conduit-mesh-contracts";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";
import { createRelayWebSocket } from "@/app/features/relays/hooks/create-relay-websocket";
import { relayHealthMonitor } from "@/app/features/relays/hooks/relay-health-monitor";
import {
  RELAY_WARMUP_PUBLIC_DIAL_STAGGER_MS,
  clearProcessPublicWarmupDials,
  partitionWarmupDialUrls,
  releaseProcessPublicWarmupDial,
} from "@/app/features/relays/services/relay-warmup-dial-cap";

export type ConduitMeshNostrWsClient = NostrWsWirePort & ConduitMeshNostrSubscriptionPort & Readonly<{
  setRelayUrls: (urls: ReadonlyArray<string>) => void;
  /**
   * Tear down every socket and dial `urls` (or previously tracked URLs when omitted).
   * Use on cold-start / open=0 recovery — `setRelayUrls` alone skips sockets stuck in `connecting`.
   */
  forceReconnectAll: (urls?: ReadonlyArray<string>) => void;
  subscribeConnections: (listener: () => void) => () => void;
  deliverInboundMessage: (relayUrl: string, message: string) => void;
  /** Re-arm REQ for all active filters on every open socket (F-RECV-LIVE). */
  resubscribeAll: () => void;
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
  /** True after success or fail-to-open has been recorded for this dial attempt. */
  connectOutcomeRecorded: boolean;
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
  const deferredPublicDialTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const clearDeferredPublicDial = (url: string): void => {
    const timer = deferredPublicDialTimers.get(url);
    if (timer) {
      clearTimeout(timer);
      deferredPublicDialTimers.delete(url);
    }
  };

  const clearAllDeferredPublicDials = (): void => {
    for (const timer of deferredPublicDialTimers.values()) {
      clearTimeout(timer);
    }
    deferredPublicDialTimers.clear();
  };

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

      // NIP-01 relay→client: ["EVENT", <subscription_id>, <event>]
      // Client publish echo / some adapters: ["EVENT", <event>]
      const eventCandidate = (
        typeof parsed[1] === "object" && parsed[1] !== null
          ? parsed[1]
          : typeof parsed[2] === "object" && parsed[2] !== null
            ? parsed[2]
            : null
      ) as ConduitMeshNostrEvent | null;
      if (!eventCandidate) {
        return;
      }

      for (const [subId, filters] of activeSubscriptions) {
        const handler = eventHandlers.get(subId);
        if (!handler) {
          continue;
        }
        if (matchesFilters(eventCandidate, filters)) {
          handler(eventCandidate, relayUrl);
        }
      }
    } catch {
      // ignore malformed relay messages
    }
  };

  const closeSocket = (url: string): void => {
    const entry = sockets.get(url);
    // Release process Quiet claim before async onclose — reconnect must re-claim.
    releaseProcessPublicWarmupDial(url);
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

    // Quiet process-wide claim lives in createRelayWebSocket (covers all dial sites).

    const entry: RelaySocketState = {
      url,
      socket: null,
      status: "connecting",
      pendingOkResolvers: new Map(),
      connectOutcomeRecorded: false,
    };
    sockets.set(url, entry);
    notifyConnectionListeners();

    relayHealthMonitor.recordConnectionAttempt(url);

    const recordOpenSuccess = (): void => {
      if (entry.connectOutcomeRecorded) {
        return;
      }
      entry.connectOutcomeRecorded = true;
      relayHealthMonitor.recordConnectionSuccess(url);
    };

    const recordOpenFailure = (reason: string): void => {
      if (entry.connectOutcomeRecorded) {
        return;
      }
      entry.connectOutcomeRecorded = true;
      relayHealthMonitor.recordConnectionFailure(url, reason);
    };

    const socket = createRelayWebSocket(url);
    entry.socket = socket;

    const connectTimeoutId = setTimeout(() => {
      if (entry.status === "connecting") {
        entry.status = "error";
        entry.errorMessage = "connect_timeout";
        recordOpenFailure("connect_timeout");
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
      recordOpenSuccess();
      // Re-arm live DM/community REQs that were registered while this socket was cold.
      sendActiveSubscriptionsToRelay(url);
      notifyConnectionListeners();
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      dispatchMessage(url, event.data);
    };

    socket.onerror = () => {
      if (entry.status === "connecting") {
        entry.status = "error";
        entry.errorMessage = "websocket_error";
        recordOpenFailure("websocket_error");
        notifyConnectionListeners();
      }
    };

    socket.onclose = () => {
      clearTimeout(connectTimeoutId);
      const wasOpen = entry.status === "open";
      const wasConnecting = entry.status === "connecting";
      if (wasConnecting) {
        recordOpenFailure("closed_before_open");
      } else if (wasOpen) {
        relayHealthMonitor.recordDisconnection(url);
      }
      entry.status = "closed";
      releaseProcessPublicWarmupDial(url);
      notifyConnectionListeners();
    };
  };

  const setRelayUrls = (urls: ReadonlyArray<string>): void => {
    // Strict Mode / HMR may have disposed a useState-owned client; allow
    // setRelayUrls (effect remount) to resurrect before publish runs.
    if (disposed) {
      disposed = false;
    }
    const normalized = dedupeUrls(urls).filter(isWebSocketRelayUrl);
    const nextSet = new Set(normalized);

    for (const existingUrl of sockets.keys()) {
      if (!nextSet.has(existingUrl)) {
        clearDeferredPublicDial(existingUrl);
        closeSocket(existingUrl);
        sockets.delete(existingUrl);
      }
    }

    // Slice 2: dial private/local + at most one public Quiet now; stagger the rest.
    const { immediate, deferredPublic } = partitionWarmupDialUrls(normalized);
    for (const url of immediate) {
      clearDeferredPublicDial(url);
      const existing = sockets.get(url);
      if (!existing || existing.status === "closed" || existing.status === "error") {
        connectRelay(url);
      }
    }
    deferredPublic.forEach((url, index) => {
      const existing = sockets.get(url);
      if (existing && existing.status !== "closed" && existing.status !== "error") {
        return;
      }
      if (deferredPublicDialTimers.has(url)) {
        return;
      }
      const timer = setTimeout(() => {
        deferredPublicDialTimers.delete(url);
        if (disposed) {
          return;
        }
        const current = sockets.get(url);
        if (!current || current.status === "closed" || current.status === "error") {
          connectRelay(url);
        }
      }, (index + 1) * RELAY_WARMUP_PUBLIC_DIAL_STAGGER_MS);
      deferredPublicDialTimers.set(url, timer);
    });

    notifyConnectionListeners();
  };

  const forceReconnectAll = (urls?: ReadonlyArray<string>): void => {
    if (disposed) {
      disposed = false;
    }
    clearAllDeferredPublicDials();
    const priorKeys = Array.from(sockets.keys());
    for (const url of priorKeys) {
      closeSocket(url);
      sockets.delete(url);
    }
    // Drop any orphan Quiet claims so the re-dial can claim again.
    clearProcessPublicWarmupDials();
    const nextUrls = urls !== undefined ? urls : priorKeys;
    if (nextUrls.length === 0) {
      notifyConnectionListeners();
      return;
    }
    setRelayUrls(nextUrls);
  };

  const resolveSocketEntry = (relayUrl: string): RelaySocketState | undefined => {
    const exact = sockets.get(relayUrl);
    if (exact) {
      return exact;
    }
    for (const entry of sockets.values()) {
      if (workspaceRelayUrlsMatch(entry.url, relayUrl)) {
        return entry;
      }
    }
    return undefined;
  };

  const sendToRelay = (relayUrl: string, payload: string): boolean => {
    const entry = resolveSocketEntry(relayUrl);
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

  /** DELIVERY-1 F-RECV-LIVE: REQ must follow socket open, not only subscribe-time open set. */
  const sendActiveSubscriptionsToRelay = (relayUrl: string): void => {
    for (const [subId, filters] of activeSubscriptions) {
      const reqPayload = JSON.stringify(["REQ", subId, ...filters]);
      sendToRelay(relayUrl, reqPayload);
    }
  };

  const resubscribeAll = (): void => {
    for (const entry of sockets.values()) {
      if (entry.status === "open") {
        sendActiveSubscriptionsToRelay(entry.url);
      }
    }
  };

  const waitForOk = (relayUrl: string, eventId: string): Promise<string | undefined> => new Promise((resolve) => {
    const entry = resolveSocketEntry(relayUrl);
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
    forceReconnectAll,
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

      // Register OK waiter before send — local relays often ACK in the same turn.
      const okMessagePromise = waitForOk(relayUrl, eventId);
      if (!sendToRelay(relayUrl, wirePayload)) {
        const entry = resolveSocketEntry(relayUrl);
        entry?.pendingOkResolvers.delete(eventId);
        return {
          accepted: false,
          eventId,
          errorMessage: "relay_not_connected",
          okMessage: JSON.stringify(["OK", eventId, false, "relay_not_connected"]),
        };
      }

      const okMessage = await okMessagePromise;
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

    resubscribeAll,

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
      clearAllDeferredPublicDials();
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
