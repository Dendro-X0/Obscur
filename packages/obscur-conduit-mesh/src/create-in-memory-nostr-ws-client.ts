import type {
  ConduitMeshNostrConnectionSnapshot,
  ConduitMeshNostrEvent,
  ConduitMeshNostrFilter,
  ConduitMeshNostrSubscriptionPort,
} from "./conduit-mesh-nostr-subscription-port";
import type { NostrWsWirePort } from "./nostr-ws-wire-port";
import { extractEventIdFromNostrWirePayload } from "@obscur/conduit-mesh-contracts";

export type InMemoryNostrWsClientOptions = Readonly<{
  now?: () => number;
  rejectRelayUrls?: ReadonlySet<string>;
  offlineRelayUrls?: ReadonlySet<string>;
}>;

type RelayStore = {
  events: string[];
};

const isWebSocketUrl = (url: string): boolean => (
  url.startsWith("ws://") || url.startsWith("wss://")
);

const buildOkMessage = (eventId: string, accepted: boolean, reason = ""): string => (
  JSON.stringify(["OK", eventId, accepted, reason])
);

let subscriptionCounter = 0;

export const resetInMemoryNostrWsClientCounters = (): void => {
  subscriptionCounter = 0;
};

/**
 * Headless Nostr WS client — combines wire publish with subscription port for C7 tests.
 */
export const createInMemoryNostrWsClient = (
  options: InMemoryNostrWsClientOptions = {},
): NostrWsWirePort & ConduitMeshNostrSubscriptionPort => {
  const now = options.now ?? (() => Date.now());
  const relayStores = new Map<string, RelayStore>();
  const messageListeners = new Set<(params: Readonly<{ url: string; message: string }>) => void>();
  const eventListeners = new Map<string, (event: ConduitMeshNostrEvent, relayUrl: string) => void>();
  const activeSubscriptions = new Map<string, ReadonlyArray<ConduitMeshNostrFilter>>();
  const connections = new Map<string, ConduitMeshNostrConnectionSnapshot>();

  const ensureStore = (relayUrl: string): RelayStore => {
    let store = relayStores.get(relayUrl);
    if (!store) {
      store = { events: [] };
      relayStores.set(relayUrl, store);
    }
    return store;
  };

  const setConnection = (url: string, status: ConduitMeshNostrConnectionSnapshot["status"], errorMessage?: string): void => {
    if (!isWebSocketUrl(url)) {
      return;
    }
    connections.set(url, {
      url,
      status,
      updatedAtUnixMs: now(),
      errorMessage,
    });
  };

  const notifyMessage = (url: string, message: string): void => {
    for (const listener of messageListeners) {
      listener({ url, message });
    }

    try {
      const parsed = JSON.parse(message) as unknown;
      if (!Array.isArray(parsed) || parsed[0] !== "EVENT") {
        return;
      }
      const event = parsed[1] as ConduitMeshNostrEvent;
      for (const [subId, filters] of activeSubscriptions) {
        const handler = eventListeners.get(subId);
        if (!handler) {
          continue;
        }
        if (matchesFilters(event, filters)) {
          handler(event, url);
        }
      }
    } catch {
      // ignore malformed messages
    }
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

  const wire: NostrWsWirePort = {
    publish: async (relayUrl, wirePayload) => {
      if (options.offlineRelayUrls?.has(relayUrl)) {
        return {
          accepted: false,
          errorMessage: "relay_offline",
          okMessage: buildOkMessage("offline", false, "relay_offline"),
        };
      }

      const eventId = extractEventIdFromNostrWirePayload(wirePayload) ?? "unknown-event";

      if (options.rejectRelayUrls?.has(relayUrl)) {
        return {
          accepted: false,
          eventId,
          errorMessage: "relay_rejected",
          okMessage: buildOkMessage(eventId, false, "relay_rejected"),
        };
      }

      ensureStore(relayUrl).events.push(wirePayload);
      setConnection(relayUrl, "open");
      notifyMessage(relayUrl, wirePayload);

      return {
        accepted: true,
        eventId,
        okMessage: buildOkMessage(eventId, true, ""),
      };
    },

    probe: async (relayUrl) => {
      if (options.offlineRelayUrls?.has(relayUrl)) {
        return { healthy: false, detail: "relay_offline" };
      }
      return { healthy: true };
    },
  };

  return {
    ...wire,

    getConnectionSnapshots: () => Array.from(connections.values()),

    subscribe: (filters, onEvent) => {
      subscriptionCounter += 1;
      const subId = `inmem-sub-${subscriptionCounter}`;
      activeSubscriptions.set(subId, filters);
      eventListeners.set(subId, onEvent);
      return subId;
    },

    unsubscribe: (subscriptionId) => {
      activeSubscriptions.delete(subscriptionId);
      eventListeners.delete(subscriptionId);
    },

    subscribeToMessages: (handler) => {
      messageListeners.add(handler);
      return () => {
        messageListeners.delete(handler);
      };
    },

    deliverInboundMessage: (relayUrl, message) => {
      notifyMessage(relayUrl, message);
    },

    sendToOpen: (payload) => {
      for (const connection of connections.values()) {
        if (connection.status === "open") {
          notifyMessage(connection.url, payload);
        }
      }
    },

    dispose: () => {
      messageListeners.clear();
      eventListeners.clear();
      activeSubscriptions.clear();
      connections.clear();
      relayStores.clear();
    },
  };
};
