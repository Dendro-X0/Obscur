/**
 * dm-relay-transport.ts
 *
 * Single canonical relay transport layer for DM messaging.
 * Owns: publish to relays, subscribe to incoming events, connection management.
 * Does NOT own: encryption, message state, persistence.
 */

import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { logAppEvent } from "@/app/shared/log-app-event";
import type {
  NostrFilter,
  PublishResult,
  RelayPoolContract,
} from "./dm-controller-types";
import { nip65Service } from "@/app/features/relays/utils/nip65-service";
import { isLocalMeshHttpGatewayUrl } from "@/app/features/relays/services/relay-transport-scope";
import { peerRelayEvidenceStore } from "../../services/peer-relay-evidence-store";
import { resolveDmHybridRelayTargeting } from "../../lib/resolve-dm-hybrid-relay-targets";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** REQ `since` lookback for DM subscriptions — a tiny window drops events on slow relays or clock skew. */
const DM_SUBSCRIBE_HISTORY_LOOKBACK_SECONDS = 86400 * 7;
const MIN_QUORUM = 1;

// Well-known high-uptime relays used as delivery fallback when the recipient's
// relay list is unknown. These mirror the pool's own offline fallback set.
// Used only when both NIP-65 and inbound evidence are empty for the peer.
const DM_DELIVERY_FALLBACK_RELAYS: ReadonlyArray<string> = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
];

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

export const publishToRelays = async (params: Readonly<{
  pool: RelayPoolContract;
  signedEvent: NostrEvent;
  targetRelayUrls?: ReadonlyArray<string>;
}>): Promise<PublishResult> => {
  const { pool, signedEvent, targetRelayUrls } = params;
  const eventPayload = JSON.stringify(["EVENT", signedEvent]);

  // Prefer scoped publish to target relays
  if (targetRelayUrls && targetRelayUrls.length > 0 && pool.publishToUrls) {
    try {
      const result = await pool.publishToUrls(targetRelayUrls, eventPayload);
      const mapped = mapPoolResult(result);
      if (mapped.success) return mapped;
      // Scoped publish failed — fall through to broadcast
      console.warn("[dm-relay-transport] publishToUrls returned failure, falling back to broadcast", {
        targetRelayCount: targetRelayUrls.length,
        successCount: mapped.successCount,
      });
    } catch (err) {
      console.warn("[dm-relay-transport] publishToUrls threw, falling back", err);
    }
  }

  // Fallback to broadcast
  if (pool.publishToAll) {
    try {
      const result = await pool.publishToAll(eventPayload);
      return mapPoolResult(result);
    } catch (err) {
      console.warn("[dm-relay-transport] publishToAll threw, falling back to sendToOpen", err);
    }
  }

  // Last resort: sendToOpen (fire-and-forget, no confirmation)
  try {
    pool.sendToOpen(eventPayload);
    const openRelayCount = pool.connections.filter(c => c.status === "open").length;
    return {
      success: openRelayCount > 0,
      successCount: openRelayCount,
      totalRelays: openRelayCount,
      outcomes: pool.connections
        .filter(c => c.status === "open")
        .map(c => ({ relayUrl: c.url, success: true })),
    };
  } catch (err) {
    return {
      success: false,
      successCount: 0,
      totalRelays: 0,
      outcomes: [],
      overallError: err instanceof Error ? err.message : String(err),
    };
  }
};

const mapPoolResult = (raw: {
  success: boolean;
  successCount: number;
  totalRelays: number;
  results: Array<{ relayUrl: string; success: boolean; error?: string; latency?: number }>;
  overallError?: string;
}): PublishResult => ({
  success: raw.successCount >= MIN_QUORUM,
  successCount: raw.successCount,
  totalRelays: raw.totalRelays,
  outcomes: raw.results.map(r => ({
    relayUrl: r.relayUrl,
    success: r.success,
    error: r.error,
    latencyMs: r.latency,
    latency: r.latency,
  })),
  overallError: raw.overallError,
});

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

export type SubscriptionHandle = Readonly<{
  id: string;
  unsubscribe: () => void;
}>;

export const subscribeToIncomingDMs = (params: Readonly<{
  pool: RelayPoolContract;
  myPublicKeyHex: string;
  onEvent: (event: NostrEvent, relayUrl: string) => void;
}>): SubscriptionHandle => {
  const { pool, myPublicKeyHex, onEvent } = params;

  // `resolveTargetRelayUrls` can publish to delivery fallbacks when the peer has
  // no NIP-65 / evidence. REQ must hit those same relays or recipients never see
  // live events while history (restore / other fetches) still shows old traffic.
  if (typeof pool.addTransientRelay === "function") {
    for (const url of DM_DELIVERY_FALLBACK_RELAYS) {
      pool.addTransientRelay(url);
    }
  }

  const pubkeyLower = myPublicKeyHex.trim().toLowerCase();
  const sinceUnixSeconds = Math.max(
    0,
    Math.floor(Date.now() / 1000) - DM_SUBSCRIBE_HISTORY_LOOKBACK_SECONDS,
  );

  const filters: ReadonlyArray<NostrFilter> = [
    {
      kinds: [4, 1059],
      "#p": [pubkeyLower],
      limit: 200,
      since: sinceUnixSeconds,
    },
    {
      kinds: [4],
      authors: [pubkeyLower],
      limit: 200,
      since: sinceUnixSeconds,
    },
  ];

  const subId = pool.subscribe(filters, (event: NostrEvent, relayUrl: string) => {
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: "debug",
      scope: { feature: "messaging", action: "delete_for_everyone" },
      context: {
        channel: "v2_subscription_event_received",
        resultCode: "received",
        reasonCode: null,
        deliveryStatus: "received",
        conversationIdHint: null,
        messageIdHint: event.id.slice(0, 16),
        conversationKind: "dm",
        isOutgoing: event.pubkey === myPublicKeyHex,
        deleteTargetCount: 0,
        remoteMessageIdHint: event.id.slice(0, 16),
      },
    });
    onEvent(event, relayUrl);
  });
  logAppEvent({
    name: "messaging.delete_for_everyone_remote_result",
    level: "info",
    scope: { feature: "messaging", action: "delete_for_everyone" },
    context: {
      channel: "v2_subscription_started",
      resultCode: "subscribed",
      reasonCode: null,
      deliveryStatus: "pending",
      conversationIdHint: null,
      messageIdHint: subId.slice(0, 16),
      conversationKind: "dm",
      isOutgoing: false,
      deleteTargetCount: 0,
      remoteMessageIdHint: null,
    },
  });

  return {
    id: subId,
    unsubscribe: () => {
      pool.unsubscribe(subId);
    },
  };
};

const dedupeRelayUrlList = (relayUrls: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(new Set(relayUrls.map((url) => url.trim()).filter((url) => url.length > 0)))
);

const resolveSenderOpenRelayUrls = (pool: RelayPoolContract): ReadonlyArray<string> => {
  if (typeof pool.getWritableRelaySnapshot === "function") {
    const snapshot = pool.getWritableRelaySnapshot();
    if (snapshot.writableRelayUrls.length > 0) {
      return snapshot.writableRelayUrls;
    }
  }
  return pool.connections
    .filter((c) => c.status === "open")
    .map((c) => c.url);
};

const resolveConfiguredSenderRelayUrls = (pool: RelayPoolContract): ReadonlyArray<string> => {
  if (typeof pool.getWritableRelaySnapshot === "function") {
    const snapshot = pool.getWritableRelaySnapshot();
    const configured = snapshot.configuredRelayUrls;
    if (Array.isArray(configured) && configured.length > 0) {
      return configured;
    }
  }
  return pool.connections.map((c) => c.url);
};

// ---------------------------------------------------------------------------
// Relay URL resolution
// ---------------------------------------------------------------------------

/** Enabled pool is loopback mesh HTTP only (C10 HTTP-only soak / team gateway). */
export const isHttpOnlyMeshTransportPool = (
  configuredRelayUrls: ReadonlyArray<string>,
): boolean => (
  configuredRelayUrls.length > 0
  && configuredRelayUrls.every((url) => isLocalMeshHttpGatewayUrl(url))
);

export const resolveTargetRelayUrls = (params: Readonly<{
  pool: RelayPoolContract;
  peerPublicKeyHex: string;
  senderPublicKeyHex: string;
  customTags?: ReadonlyArray<ReadonlyArray<string>>;
  profileId?: string;
}>): ReadonlyArray<string> => {
  const { pool, peerPublicKeyHex, senderPublicKeyHex, customTags, profileId } = params;
  const recipientInboundRelayUrls = peerRelayEvidenceStore.getRelayUrls(peerPublicKeyHex, profileId);
  const recipientWriteRelayUrls = nip65Service.getWriteRelays(peerPublicKeyHex as never);
  const configuredSenderRelayUrls = resolveConfiguredSenderRelayUrls(pool);

  // Hybrid targeting unions peer NIP-65 / inbound evidence (often public wss://).
  // When the user pool is HTTP-only mesh, publish must stay on configured gateways.
  if (isHttpOnlyMeshTransportPool(configuredSenderRelayUrls)) {
    return dedupeRelayUrlList(configuredSenderRelayUrls);
  }

  const senderWriteRelayUrls = dedupeRelayUrlList([
    ...nip65Service.getWriteRelays(senderPublicKeyHex as never),
    ...configuredSenderRelayUrls,
  ]);
  const senderOpenRelayUrls = resolveSenderOpenRelayUrls(pool);

  const targeting = resolveDmHybridRelayTargeting({
    customTags,
    discoveredRecipientRelayUrls: [],
    senderOpenRelayUrls,
    senderWriteRelayUrls,
    recipientWriteRelayUrls,
    recipientInboundRelayUrls,
  });

  let urls = [...targeting.targetRelayUrls];
  if (
    recipientInboundRelayUrls.length === 0
    && recipientWriteRelayUrls.length === 0
    && targeting.recipientScopeRelayUrls.length === 0
  ) {
    urls = [...dedupeRelayUrlList([...urls, ...DM_DELIVERY_FALLBACK_RELAYS])];
  }
  return dedupeRelayUrlList(urls);
};
