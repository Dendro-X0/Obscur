"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";

export type DeliverySyncSnapshot = Readonly<{
  status: "idle" | "running" | "completed" | "timed_out" | "failed";
  subId?: string;
  sinceUnixSeconds?: number;
  openRelayUrls: ReadonlyArray<string>;
  startedAtUnixMs?: number;
  completedAtUnixMs?: number;
  matchedEventCount: number;
  matchedEventIds: ReadonlyArray<string>;
  maxMatchedCreatedAtUnixSeconds?: number;
  eoseRelayUrls: ReadonlyArray<string>;
  checkpointUpdatedToUnixSeconds?: number;
  reason?: string;
}>;

export type DeliveryPublishSnapshot = Readonly<{
  atUnixMs: number;
  peerPublicKeyHex: PublicKeyHex;
  eventId?: string;
  relayUrls: ReadonlyArray<string>;
  relayScopeSource?: string;
  deliveryStatus?: string;
  success?: boolean;
  successCount?: number;
  totalRelays?: number;
  reasonCode?: string;
  error?: string;
}>;

export type DeliveryIncomingSnapshot = Readonly<{
  atUnixMs: number;
  eventId: string;
  kind: number;
  senderPubkey: string;
  recipientPubkey?: string;
  relayUrl?: string;
  action:
    | "seen"
    | "ignored"
    | "decrypt_failed"
    | "receipt_ack"
    | "requests_inbox"
    | "accepted_contact";
  reason?: string;
  routedPeerPubkey?: string;
}>;

export type DeliverySubscriptionSnapshot = Readonly<{
  atUnixMs: number;
  subId: string;
  relayUrls: ReadonlyArray<string>;
  myPublicKeyHex: PublicKeyHex;
}>;

export type DeliveryDiagnosticsSnapshot = Readonly<{
  updatedAtUnixMs: number;
  myPublicKeyHex?: PublicKeyHex;
  hasPrivateKey: boolean;
  lastSubscription?: DeliverySubscriptionSnapshot;
  lastSync: DeliverySyncSnapshot;
  lastPublish?: DeliveryPublishSnapshot;
  lastIncoming?: DeliveryIncomingSnapshot;
}>;

type DeliveryDiagnosticsTools = Readonly<{
  getSnapshot: () => DeliveryDiagnosticsSnapshot;
  clear: () => void;
}>;

declare global {
  interface Window {
    obscurDeliveryDiagnostics?: DeliveryDiagnosticsTools;
  }
}

const createEmptySyncSnapshot = (): DeliverySyncSnapshot => ({
  status: "idle",
  openRelayUrls: [],
  matchedEventCount: 0,
  matchedEventIds: [],
  eoseRelayUrls: [],
});

const createDefaultSnapshot = (): DeliveryDiagnosticsSnapshot => ({
  updatedAtUnixMs: Date.now(),
  hasPrivateKey: false,
  lastSync: createEmptySyncSnapshot(),
});

let snapshot: DeliveryDiagnosticsSnapshot = createDefaultSnapshot();

const installTools = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  if (process.env.NODE_ENV === "production") {
    return;
  }
  window.obscurDeliveryDiagnostics = {
    getSnapshot: () => snapshot,
    clear: () => {
      snapshot = createDefaultSnapshot();
      installTools();
    },
  };
};

const setSnapshot = (next: DeliveryDiagnosticsSnapshot): void => {
  snapshot = next;
  installTools();
};

const updateSnapshot = (
  updater: (current: DeliveryDiagnosticsSnapshot) => DeliveryDiagnosticsSnapshot
): DeliveryDiagnosticsSnapshot => {
  const next = updater(snapshot);
  setSnapshot(next);
  return next;
};

const getNormalizedEventIds = (ids: Iterable<string>): ReadonlyArray<string> => {
  return Array.from(new Set(ids)).slice(-20);
};

export const deliveryDiagnosticsStore = {
  getSnapshot(): DeliveryDiagnosticsSnapshot {
    installTools();
    return snapshot;
  },
  clear(): void {
    setSnapshot(createDefaultSnapshot());
  },
  setIdentity(params: Readonly<{ myPublicKeyHex?: PublicKeyHex | null; hasPrivateKey: boolean }>): void {
    updateSnapshot((current) => ({
      ...current,
      updatedAtUnixMs: Date.now(),
      myPublicKeyHex: params.myPublicKeyHex ?? undefined,
      hasPrivateKey: params.hasPrivateKey,
    }));
  },
  markSubscription(params: Readonly<{
    subId: string;
    relayUrls: ReadonlyArray<string>;
    myPublicKeyHex: PublicKeyHex;
  }>): void {
    updateSnapshot((current) => ({
      ...current,
      updatedAtUnixMs: Date.now(),
      lastSubscription: {
        atUnixMs: Date.now(),
        subId: params.subId,
        relayUrls: [...params.relayUrls],
        myPublicKeyHex: params.myPublicKeyHex,
      },
    }));
  },
  startSync(params: Readonly<{
    subId: string;
    sinceUnixSeconds: number;
    openRelayUrls: ReadonlyArray<string>;
  }>): void {
    updateSnapshot((current) => ({
      ...current,
      updatedAtUnixMs: Date.now(),
      lastSync: {
        status: "running",
        subId: params.subId,
        sinceUnixSeconds: params.sinceUnixSeconds,
        openRelayUrls: [...params.openRelayUrls],
        startedAtUnixMs: Date.now(),
        matchedEventCount: 0,
        matchedEventIds: [],
        eoseRelayUrls: [],
      },
    }));
  },
  markSyncEvent(event: Pick<NostrEvent, "id" | "created_at">): void {
    updateSnapshot((current) => {
      const previous = current.lastSync;
      const matchedEventIds = getNormalizedEventIds([
        ...previous.matchedEventIds,
        event.id,
      ]);
      return {
        ...current,
        updatedAtUnixMs: Date.now(),
        lastSync: {
          ...previous,
          matchedEventCount: previous.matchedEventCount + 1,
          matchedEventIds,
          maxMatchedCreatedAtUnixSeconds: Math.max(
            previous.maxMatchedCreatedAtUnixSeconds ?? 0,
            event.created_at
          ),
        },
      };
    });
  },
  markSyncEose(relayUrl: string): void {
    updateSnapshot((current) => {
      const previous = current.lastSync;
      return {
        ...current,
        updatedAtUnixMs: Date.now(),
        lastSync: {
          ...previous,
          eoseRelayUrls: getNormalizedEventIds([
            ...previous.eoseRelayUrls,
            relayUrl,
          ]),
        },
      };
    });
  },
  completeSync(params: Readonly<{
    status: DeliverySyncSnapshot["status"];
    reason?: string;
    checkpointUpdatedToUnixSeconds?: number;
  }>): void {
    updateSnapshot((current) => ({
      ...current,
      updatedAtUnixMs: Date.now(),
      lastSync: {
        ...current.lastSync,
        status: params.status,
        completedAtUnixMs: Date.now(),
        reason: params.reason,
        checkpointUpdatedToUnixSeconds: params.checkpointUpdatedToUnixSeconds,
      },
    }));
  },
  markPublish(params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    eventId?: string;
    relayUrls: ReadonlyArray<string>;
    relayScopeSource?: string;
    deliveryStatus?: string;
    success?: boolean;
    successCount?: number;
    totalRelays?: number;
    reasonCode?: string;
    error?: string;
  }>): void {
    updateSnapshot((current) => ({
      ...current,
      updatedAtUnixMs: Date.now(),
      lastPublish: {
        atUnixMs: Date.now(),
        peerPublicKeyHex: params.peerPublicKeyHex,
        eventId: params.eventId,
        relayUrls: [...params.relayUrls],
        relayScopeSource: params.relayScopeSource,
        deliveryStatus: params.deliveryStatus,
        success: params.success,
        successCount: params.successCount,
        totalRelays: params.totalRelays,
        reasonCode: params.reasonCode,
        error: params.error,
      },
    }));
  },
  markIncoming(params: Readonly<{
    eventId: string;
    kind: number;
    senderPubkey: string;
    recipientPubkey?: string;
    relayUrl?: string;
    action: DeliveryIncomingSnapshot["action"];
    reason?: string;
    routedPeerPubkey?: string;
  }>): void {
    updateSnapshot((current) => ({
      ...current,
      updatedAtUnixMs: Date.now(),
      lastIncoming: {
        atUnixMs: Date.now(),
        eventId: params.eventId,
        kind: params.kind,
        senderPubkey: params.senderPubkey,
        recipientPubkey: params.recipientPubkey,
        relayUrl: params.relayUrl,
        action: params.action,
        reason: params.reason,
        routedPeerPubkey: params.routedPeerPubkey,
      },
    }));
  },
};
