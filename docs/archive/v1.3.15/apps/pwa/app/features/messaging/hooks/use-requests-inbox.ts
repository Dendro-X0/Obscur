"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

import type { ConnectionRequestStatusValue, RequestsInboxItem } from "@/app/features/messaging/types";


import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { appendCanonicalContactEvent } from "@/app/features/account-sync/services/account-event-ingest-bridge";
import { resolveProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import { selectProjectionRequestsInboxItems } from "@/app/features/account-sync/services/account-projection-selectors";
import { shouldWriteLegacyContactsDm } from "@/app/features/account-sync/services/account-sync-migration-policy";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
import { clearRequestCooldown, setRequestCooldown } from "../services/request-anti-abuse";
import { requestFlowEvidenceStore } from "../services/request-flow-evidence-store";
import { requestEventTombstoneStore } from "../services/request-event-tombstone-store";
import {
  transitionHandshake,
  shouldProcessAsNewRequest,
  type HandshakeEvent,
  type HandshakeState
} from "../state-machines/connection-handshake-machine";

type RequestsInboxState = Readonly<{
  items: ReadonlyArray<RequestsInboxItem>;
}>;

type UseRequestsInboxParams = Readonly<{
  publicKeyHex: PublicKeyHex | null;
}>;

type UseRequestsInboxResult = Readonly<{
  state: RequestsInboxState;
  upsertIncoming: (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    plaintext: string;
    createdAtUnixSeconds: number;
    observedAtUnixSeconds?: number;
    isRequest?: boolean;
    status?: ConnectionRequestStatusValue;
    eventId?: string;
    ingestSource?: "relay_live" | "relay_sync";
  }>) => void;
  remove: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => void;
  markRead: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => void;
  markAllRead: () => void;
  clearHistory: () => void;
  setStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: ConnectionRequestStatusValue; isOutgoing?: boolean }>) => void;
  getRequestStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => { status?: ConnectionRequestStatusValue; isOutgoing: boolean; lastReceivedAtUnixSeconds?: number } | null;
  hasHydrated: boolean;
}>;

type StoredRequestsInbox = Readonly<{
  items: ReadonlyArray<RequestsInboxItem>;
}>;

const mergeHydratedRequestsInboxItems = (
  currentItems: ReadonlyArray<RequestsInboxItem>,
  hydratedItems: ReadonlyArray<RequestsInboxItem>
): ReadonlyArray<RequestsInboxItem> => {
  const byPeer = new Map<string, RequestsInboxItem>();

  hydratedItems.forEach((item) => {
    byPeer.set(item.peerPublicKeyHex, item);
  });

  currentItems.forEach((current) => {
    const existing = byPeer.get(current.peerPublicKeyHex);
    if (!existing) {
      byPeer.set(current.peerPublicKeyHex, current);
      return;
    }

    const preferCurrent = current.lastReceivedAtUnixSeconds >= existing.lastReceivedAtUnixSeconds;
    const newer = preferCurrent ? current : existing;
    const older = preferCurrent ? existing : current;

    byPeer.set(current.peerPublicKeyHex, {
      ...older,
      ...newer,
      unreadCount: Math.max(current.unreadCount, existing.unreadCount),
      lastReceivedAtUnixSeconds: Math.max(current.lastReceivedAtUnixSeconds, existing.lastReceivedAtUnixSeconds),
      eventId: newer.eventId ?? older.eventId,
    });
  });

  return Array.from(byPeer.values()).sort((a, b) => b.lastReceivedAtUnixSeconds - a.lastReceivedAtUnixSeconds);
};

const createDefaultState = (): StoredRequestsInbox => {
  return { items: [] };
};

const createPreview = (plaintext: string): string => {
  const normalized: string = plaintext.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 140)}…` : normalized;
};

const REQUEST_PENDING_STALE_MS = 3 * 60 * 1000;
const HISTORICAL_SYNC_UNREAD_THRESHOLD_SECONDS = 5 * 60;

const shouldReleaseOutgoingPendingRequest = (
  item: RequestsInboxItem,
  nowUnixMs = Date.now(),
  staleAfterMs = REQUEST_PENDING_STALE_MS
): boolean => {
  if (!item.isOutgoing) return false;
  if (item.status && item.status !== "pending") return false;

  const evidence = requestFlowEvidenceStore.get(item.peerPublicKeyHex);
  if (evidence.acceptSeen || evidence.receiptAckSeen) {
    return false;
  }
  if (typeof item.lastReceivedAtUnixSeconds !== "number") {
    return false;
  }
  return (nowUnixMs - (item.lastReceivedAtUnixSeconds * 1000)) >= staleAfterMs;
};

const filterReleasedOutgoingPendingRequests = (
  items: ReadonlyArray<RequestsInboxItem>,
  nowUnixMs = Date.now(),
  staleAfterMs = REQUEST_PENDING_STALE_MS
): ReadonlyArray<RequestsInboxItem> => {
  return items.filter((item) => !shouldReleaseOutgoingPendingRequest(item, nowUnixMs, staleAfterMs));
};

const resolveExistingRequestForIncoming = (
  item: RequestsInboxItem | undefined,
  nowUnixMs = Date.now(),
  staleAfterMs = REQUEST_PENDING_STALE_MS
): RequestsInboxItem | undefined => {
  if (!item) {
    return undefined;
  }
  if (shouldReleaseOutgoingPendingRequest(item, nowUnixMs, staleAfterMs)) {
    return undefined;
  }
  return item;
};

const shouldIgnoreIncomingForExistingRequest = (
  existing: RequestsInboxItem,
  incomingCreatedAtUnixSeconds: number,
  incomingEventId?: string
): boolean => {
  if (shouldProcessAsNewRequest(existing.status)) {
    return false;
  }
  if (existing.status !== "pending") {
    return true;
  }
  const hasNewerTimestamp = incomingCreatedAtUnixSeconds >= existing.lastReceivedAtUnixSeconds;
  const hasDistinctEventId = Boolean(incomingEventId && incomingEventId !== existing.eventId);
  return !(hasNewerTimestamp || hasDistinctEventId);
};

const resolveIncomingTimestampForExistingRequest = (
  existing: RequestsInboxItem,
  incomingCreatedAtUnixSeconds: number,
  incomingEventId?: string,
  isRequest?: boolean,
  observedAtUnixSeconds = Math.floor(Date.now() / 1000)
): number => {
  const hasDistinctEventId = Boolean(incomingEventId && incomingEventId !== existing.eventId);
  if (
    Boolean(isRequest)
    && hasDistinctEventId
    && incomingCreatedAtUnixSeconds <= existing.lastReceivedAtUnixSeconds
  ) {
    return observedAtUnixSeconds;
  }
  return incomingCreatedAtUnixSeconds;
};

const normalizeObservedAtUnixSeconds = (
  observedAtUnixSeconds: number | undefined,
  nowUnixSeconds = Math.floor(Date.now() / 1000)
): number => {
  if (typeof observedAtUnixSeconds !== "number" || !Number.isFinite(observedAtUnixSeconds)) {
    return nowUnixSeconds;
  }
  const normalizedObservedAt = Math.floor(observedAtUnixSeconds);
  if (normalizedObservedAt <= 0) {
    return nowUnixSeconds;
  }
  return normalizedObservedAt;
};

const resolveIncomingInboxTimelineTimestamp = (params: Readonly<{
  createdAtUnixSeconds: number;
  observedAtUnixSeconds: number;
  isRequest?: boolean;
}>): number => {
  if (params.isRequest) {
    return params.observedAtUnixSeconds;
  }
  return params.createdAtUnixSeconds;
};

const shouldSuppressUnreadForHistoricalSync = (params: Readonly<{
  ingestSource?: "relay_live" | "relay_sync";
  createdAtUnixSeconds: number;
  observedAtUnixSeconds: number;
  thresholdSeconds?: number;
}>): boolean => {
  if (params.ingestSource !== "relay_sync") {
    return false;
  }
  return (params.observedAtUnixSeconds - params.createdAtUnixSeconds) > (params.thresholdSeconds ?? HISTORICAL_SYNC_UNREAD_THRESHOLD_SECONDS);
};

const toHandshakeEvent = (status: ConnectionRequestStatusValue, isOutgoing: boolean): HandshakeEvent => {
  if (status === "accepted") return { type: "ACCEPT" };
  if (status === "declined") return { type: "DECLINE" };
  if (status === "canceled") return { type: "CANCEL" };
  return { type: isOutgoing ? "SEND_REQUEST" : "RECEIVE_REQUEST" };
};

const resolveNextHandshakeState = (params: Readonly<{
  currentState: HandshakeState;
  status: ConnectionRequestStatusValue;
  isOutgoing: boolean;
}>): HandshakeState => {
  if (params.currentState.status === "none") {
    if (params.status === "accepted") {
      return { status: "accepted", isOutgoing: params.isOutgoing };
    }
    if (params.status === "declined") {
      return { status: "declined", isOutgoing: params.isOutgoing };
    }
    if (params.status === "canceled") {
      return { status: "canceled", isOutgoing: params.isOutgoing };
    }
  }
  return transitionHandshake(params.currentState, toHandshakeEvent(params.status, params.isOutgoing));
};

const shouldApplyStatusUpdate = (params: Readonly<{
  item: RequestsInboxItem;
  nextState: HandshakeState;
}>): boolean => {
  const nextStatus: ConnectionRequestStatusValue | undefined = params.nextState.status === "none"
    ? undefined
    : params.nextState.status;
  const nextUnread = nextStatus === "pending" ? params.item.unreadCount : 0;
  const currentIsOutgoing = params.item.isOutgoing ?? false;
  return params.item.status !== nextStatus
    || params.item.unreadCount !== nextUnread
    || currentIsOutgoing !== params.nextState.isOutgoing;
};

export const useRequestsInbox = (params: UseRequestsInboxParams): UseRequestsInboxResult => {
  const projectionSnapshot = useAccountProjectionSnapshot();
  const activeProfileId = getActiveProfileIdSafe();
  const projectionReadAuthority = useMemo(() => (
    resolveProjectionReadAuthority({
      projectionSnapshot,
      expectedProfileId: activeProfileId,
      expectedAccountPublicKeyHex: params.publicKeyHex,
    })
  ), [activeProfileId, params.publicKeyHex, projectionSnapshot]);
  const projectionItems = useMemo(
    () => selectProjectionRequestsInboxItems(projectionSnapshot.projection),
    [projectionSnapshot.projection]
  );
  const shouldUseProjectionReads = projectionReadAuthority.useProjectionReads;
  const shouldWriteLegacyContacts = shouldWriteLegacyContactsDm(projectionReadAuthority.policy);

  const publicKeyHexRef = useRef<PublicKeyHex | null>(params.publicKeyHex);
  const storedOwnerPublicKeyHexRef = useRef<PublicKeyHex | null>(params.publicKeyHex);
  useEffect(() => {
    publicKeyHexRef.current = params.publicKeyHex;
  }, [params.publicKeyHex]);

  const [stored, setStored] = useState<StoredRequestsInbox>(createDefaultState());
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect((): void => {
    if (!params.publicKeyHex) {
      storedOwnerPublicKeyHexRef.current = null;
      setStored(createDefaultState());
      return;
    }
    const persisted = chatStateStoreService.load(params.publicKeyHex);
    if (persisted && persisted.connectionRequests) {
      const hydratedItems = persisted.connectionRequests
        .map((item): RequestsInboxItem | undefined => {
          const normalized = normalizePublicKeyHex(item.id);
          if (!normalized) return undefined;
          return {
            peerPublicKeyHex: normalized,
            status: item.status,
            isOutgoing: item.isOutgoing,
            lastMessagePreview: item.introMessage || "",
            lastReceivedAtUnixSeconds: Math.floor((item.timestampMs || 0) / 1000),
            unreadCount: 0,
            eventId: item.eventId,
          } satisfies RequestsInboxItem;
        })
        .filter((item): item is RequestsInboxItem => item !== undefined);

      setStored((prev) => ({
        items: storedOwnerPublicKeyHexRef.current === params.publicKeyHex
          ? mergeHydratedRequestsInboxItems(prev.items, hydratedItems)
          : hydratedItems,
      }));
      storedOwnerPublicKeyHexRef.current = params.publicKeyHex;
      setHasHydrated(true);
    } else {
      storedOwnerPublicKeyHexRef.current = params.publicKeyHex;
      setHasHydrated(true); // Treat "no data" as hydrated too once check is done
    }
  }, [params.publicKeyHex]);

  const [processedEventIds] = useState<Set<string>>(() => new Set());

  const persistChange = useCallback((next: StoredRequestsInbox) => {
    if (!shouldWriteLegacyContacts) {
      return;
    }
    const pk = publicKeyHexRef.current;
    if (pk) {
      chatStateStoreService.updateConnectionRequests(pk, next.items.map(item => ({
        id: item.peerPublicKeyHex,
        status: item.status || 'pending',
        isOutgoing: item.isOutgoing ?? false,
        introMessage: item.lastMessagePreview,
        timestampMs: item.lastReceivedAtUnixSeconds * 1000,
        eventId: item.eventId,
      })));
    }
  }, [shouldWriteLegacyContacts]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const filteredItems = filterReleasedOutgoingPendingRequests(prev.items);
      if (filteredItems.length === prev.items.length) {
        return prev;
      }
      const next = { items: filteredItems };
      persistChange(next);
      return next;
    });
  }, [hasHydrated, persistChange]);

  const upsertIncoming = useCallback((p: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    plaintext: string;
    createdAtUnixSeconds: number;
    observedAtUnixSeconds?: number;
    isRequest?: boolean;
    status?: ConnectionRequestStatusValue;
    eventId?: string;
    ingestSource?: "relay_live" | "relay_sync";
  }>): void => {
    if (!shouldWriteLegacyContacts) {
      return;
    }
    const normalizedPeer = normalizePublicKeyHex(p.peerPublicKeyHex);
    if (!normalizedPeer) {
      return;
    }
    if (p.eventId && requestEventTombstoneStore.isSuppressed(p.eventId)) {
      return;
    }
    if (p.eventId) {
      if (processedEventIds.has(p.eventId)) return;
      processedEventIds.add(p.eventId);
    }
    const observedAtUnixSeconds = normalizeObservedAtUnixSeconds(p.observedAtUnixSeconds);
    const suppressUnreadForHistoricalSync = shouldSuppressUnreadForHistoricalSync({
      ingestSource: p.ingestSource,
      createdAtUnixSeconds: p.createdAtUnixSeconds,
      observedAtUnixSeconds,
    });
    const incomingTimelineUnixSeconds = resolveIncomingInboxTimelineTimestamp({
      createdAtUnixSeconds: p.createdAtUnixSeconds,
      observedAtUnixSeconds,
      isRequest: p.isRequest,
    });

    const preview: string = createPreview(p.plaintext);
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const existingRaw: RequestsInboxItem | undefined = prev.items.find((i: RequestsInboxItem): boolean => i.peerPublicKeyHex === normalizedPeer);
      const existing = resolveExistingRequestForIncoming(existingRaw);
      const priorItems = existingRaw && !existing
        ? prev.items.filter((i: RequestsInboxItem): boolean => i.peerPublicKeyHex !== normalizedPeer)
        : prev.items;

      if (existing && shouldIgnoreIncomingForExistingRequest(existing, incomingTimelineUnixSeconds, p.eventId)) {
        return prev;
      }

      let nextItems: RequestsInboxItem[];

      if (!existing) {
        const nextItem: RequestsInboxItem = {
          peerPublicKeyHex: normalizedPeer,
          lastMessagePreview: preview,
          lastReceivedAtUnixSeconds: incomingTimelineUnixSeconds,
          unreadCount: suppressUnreadForHistoricalSync ? 0 : 1,
          isRequest: p.isRequest,
          status: p.status,
          eventId: p.eventId,
        };
        nextItems = [nextItem, ...priorItems];
      } else {
        const normalizedIncomingUnixSeconds = resolveIncomingTimestampForExistingRequest(
          existing,
          incomingTimelineUnixSeconds,
          p.eventId,
          p.isRequest,
          observedAtUnixSeconds
        );
        const isNewer = normalizedIncomingUnixSeconds > existing.lastReceivedAtUnixSeconds;
        const currentStatus = p.status ?? existing.status;
        const shouldRaiseUnread = !suppressUnreadForHistoricalSync && isNewer && (currentStatus === 'pending' || !currentStatus);
        const isPendingState = currentStatus === "pending" || !currentStatus;
        const nextUnread: number = !isPendingState
          ? 0
          : (
            suppressUnreadForHistoricalSync
              ? existing.unreadCount
              :
            // Keep pending-request unread as a binary signal per peer.
            // Retries/replays can emit multiple request events; those should not
            // stack unread indefinitely for a single inbox row.
            shouldRaiseUnread
              ? Math.max(existing.unreadCount, 1)
              : existing.unreadCount
          );

        const updated: RequestsInboxItem = {
          peerPublicKeyHex: existing.peerPublicKeyHex,
          lastMessagePreview: isNewer ? preview : existing.lastMessagePreview,
          lastReceivedAtUnixSeconds: Math.floor(Math.max(existing.lastReceivedAtUnixSeconds, normalizedIncomingUnixSeconds)),
          unreadCount: nextUnread,
          isRequest: p.isRequest ?? existing.isRequest,
          status: p.status ?? existing.status,
          eventId: p.eventId ?? existing.eventId,
        };
        nextItems = [updated, ...priorItems.filter((i: RequestsInboxItem): boolean => i.peerPublicKeyHex !== normalizedPeer)];
      }

      const next = { items: nextItems };
      persistChange(next);
      return next;
    });
  }, [processedEventIds, persistChange, shouldWriteLegacyContacts]);

  const remove = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
    const normalizedPeer = normalizePublicKeyHex(p.peerPublicKeyHex);
    if (!normalizedPeer) return;
    const currentItems = shouldUseProjectionReads ? projectionItems : stored.items;
    const current = currentItems.find((item) => item.peerPublicKeyHex === normalizedPeer);
    if (!shouldWriteLegacyContacts) {
      const pk = publicKeyHexRef.current;
      if (pk && current) {
        void appendCanonicalContactEvent({
          accountPublicKeyHex: pk,
          peerPublicKeyHex: normalizedPeer,
          type: current.isOutgoing ? "CONTACT_CANCELED" : "CONTACT_DECLINED",
          direction: current.isOutgoing ? "outgoing" : "incoming",
          requestEventId: current.eventId,
          idempotencySuffix: `remove:${current.eventId ?? normalizedPeer}`,
          source: "legacy_bridge",
        });
      }
      emitAccountSyncMutation("requests_inbox_status_changed");
      return;
    }
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const existing = prev.items.find((i: RequestsInboxItem): boolean => i.peerPublicKeyHex === normalizedPeer);
      if (!existing) {
        return prev;
      }
      if (existing?.eventId) {
        requestEventTombstoneStore.suppress(existing.eventId);
      }
      // Removing a request/contact entry must also drop request-flow evidence.
      // Otherwise stale receipt/accept evidence can misroute future DMs as pending.
      requestFlowEvidenceStore.reset(normalizedPeer);
      const next = { items: prev.items.filter((i: RequestsInboxItem): boolean => i.peerPublicKeyHex !== normalizedPeer) };
      persistChange(next);
      emitAccountSyncMutation("requests_inbox_status_changed");
      return next;
    });
  }, [persistChange, projectionItems, shouldUseProjectionReads, shouldWriteLegacyContacts, stored.items]);

  const markRead = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
    const normalizedPeer = normalizePublicKeyHex(p.peerPublicKeyHex);
    if (!normalizedPeer) return;
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const next = {
        items: prev.items.map((i: RequestsInboxItem): RequestsInboxItem => {
          if (i.peerPublicKeyHex !== normalizedPeer) return i;
          return { ...i, unreadCount: 0 };
        })
      };
      persistChange(next);
      return next;
    });
  }, [persistChange]);

  const markAllRead = useCallback((): void => {
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const next = {
        items: prev.items.map((i: RequestsInboxItem): RequestsInboxItem => ({ ...i, unreadCount: 0 }))
      };
      persistChange(next);
      return next;
    });
  }, [persistChange]);

  const clearHistory = useCallback((): void => {
    if (!shouldWriteLegacyContacts) {
      emitAccountSyncMutation("requests_inbox_status_changed");
      return;
    }
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      prev.items.forEach((item) => {
        if (item.eventId) {
          requestEventTombstoneStore.suppress(item.eventId);
        }
        requestFlowEvidenceStore.reset(item.peerPublicKeyHex);
      });
      const next = { items: [] };
      persistChange(next);
      if (prev.items.length > 0) {
        emitAccountSyncMutation("requests_inbox_status_changed");
      }
      return next;
    });
  }, [persistChange, shouldWriteLegacyContacts]);

  const setStatus = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: ConnectionRequestStatusValue; isOutgoing?: boolean }>): void => {
    if (!shouldWriteLegacyContacts) {
      return;
    }
    const normalizedPeer = normalizePublicKeyHex(p.peerPublicKeyHex);
    if (!normalizedPeer) return;
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const existing = prev.items.find(i => i.peerPublicKeyHex === normalizedPeer);
      const isOutgoing = p.isOutgoing ?? existing?.isOutgoing ?? false;
      const myPublicKey = publicKeyHexRef.current;
      if (myPublicKey && isOutgoing) {
        if (p.status === "declined") {
          setRequestCooldown({
            myPublicKeyHex: myPublicKey,
            peerPublicKeyHex: normalizedPeer,
            reason: "declined"
          });
        } else if (p.status === "canceled") {
          setRequestCooldown({
            myPublicKeyHex: myPublicKey,
            peerPublicKeyHex: normalizedPeer,
            reason: "canceled"
          });
        } else if (p.status === "accepted" || p.status === "pending") {
          clearRequestCooldown({
            myPublicKeyHex: myPublicKey,
            peerPublicKeyHex: normalizedPeer
          });
        }
      }
      if (existing?.eventId && (p.status === "accepted" || p.status === "declined" || p.status === "canceled")) {
        requestEventTombstoneStore.suppress(existing.eventId);
      }
      let nextItems: RequestsInboxItem[];
      let didChange = false;

      if (!existing) {
        const nextState = resolveNextHandshakeState({
          currentState: { status: "none", isOutgoing: false },
          status: p.status,
          isOutgoing: Boolean(isOutgoing),
        });
        const nextStatus: ConnectionRequestStatusValue | undefined = nextState.status === "none" ? undefined : nextState.status;

        const newItem: RequestsInboxItem = {
          peerPublicKeyHex: normalizedPeer,
          lastMessagePreview: "",
          lastReceivedAtUnixSeconds: Math.floor(Date.now() / 1000),
          unreadCount: 0,
          status: nextStatus,
          isOutgoing: nextState.isOutgoing
        };
        nextItems = [newItem, ...prev.items];
        didChange = true;
      } else {
        const nowUnixSeconds = Math.floor(Date.now() / 1000);
        nextItems = prev.items.map((i: RequestsInboxItem): RequestsInboxItem => {
          if (i.peerPublicKeyHex !== normalizedPeer) return i;

          const currentState: HandshakeState = {
            status: i.status || "none",
            isOutgoing: i.isOutgoing ?? false
          };

          const nextState = resolveNextHandshakeState({
            currentState,
            status: p.status,
            isOutgoing: Boolean(isOutgoing),
          });
          if (!shouldApplyStatusUpdate({ item: i, nextState })) {
            return i;
          }
          didChange = true;
          const nextStatus: ConnectionRequestStatusValue | undefined = nextState.status === "none" ? undefined : nextState.status;
          const nextUnread = nextStatus === "pending" ? i.unreadCount : 0;

          return {
            ...i,
            status: nextStatus,
            unreadCount: nextUnread,
            isOutgoing: nextState.isOutgoing,
            lastReceivedAtUnixSeconds: Math.max(i.lastReceivedAtUnixSeconds, nowUnixSeconds),
          };
        });
      }
      if (!didChange) {
        return prev;
      }

      const next = { items: nextItems };
      persistChange(next);
      emitAccountSyncMutation("requests_inbox_status_changed");
      return next;
    });
  }, [persistChange, shouldWriteLegacyContacts]);

  const state: RequestsInboxState = useMemo((): RequestsInboxState => {
    return {
      items: shouldUseProjectionReads
        ? projectionItems
        : filterReleasedOutgoingPendingRequests(stored.items),
    };
  }, [projectionItems, shouldUseProjectionReads, stored.items]);

  const getRequestStatus = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): { status?: ConnectionRequestStatusValue; isOutgoing: boolean; lastReceivedAtUnixSeconds?: number } | null => {
    const normalizedPeer = normalizePublicKeyHex(p.peerPublicKeyHex);
    if (!normalizedPeer) return null;
    const item = state.items.find(i => i.peerPublicKeyHex === normalizedPeer);
    if (!item) return null;
    if (!shouldUseProjectionReads && shouldReleaseOutgoingPendingRequest(item)) {
      return null;
    }
    return { status: item.status, isOutgoing: item.isOutgoing || false, lastReceivedAtUnixSeconds: item.lastReceivedAtUnixSeconds };
  }, [shouldUseProjectionReads, state.items]);

  return useMemo(
    () => ({ state, upsertIncoming, remove, markRead, markAllRead, clearHistory, setStatus, getRequestStatus, hasHydrated }),
    [state, upsertIncoming, remove, markRead, markAllRead, clearHistory, setStatus, getRequestStatus, hasHydrated]
  );
};

export const requestsInboxInternals = {
  createPreview,
  mergeHydratedRequestsInboxItems,
  toHandshakeEvent,
  resolveNextHandshakeState,
  shouldApplyStatusUpdate,
  normalizeObservedAtUnixSeconds,
  resolveIncomingInboxTimelineTimestamp,
  shouldSuppressUnreadForHistoricalSync,
  shouldReleaseOutgoingPendingRequest,
  resolveExistingRequestForIncoming,
  shouldIgnoreIncomingForExistingRequest,
  resolveIncomingTimestampForExistingRequest,
  filterReleasedOutgoingPendingRequests,
  REQUEST_PENDING_STALE_MS,
  HISTORICAL_SYNC_UNREAD_THRESHOLD_SECONDS,
};
