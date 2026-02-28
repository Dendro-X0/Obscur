"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

import type { ConnectionRequestStatusValue, RequestsInboxItem } from "@/app/features/messaging/types";


import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import {
  transitionHandshake,
  shouldProcessAsNewRequest,
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
    isRequest?: boolean;
    status?: ConnectionRequestStatusValue;
    eventId?: string;
  }>) => void;
  remove: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => void;
  markRead: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => void;
  markAllRead: () => void;
  clearHistory: () => void;
  setStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: ConnectionRequestStatusValue; isOutgoing?: boolean }>) => void;
  getRequestStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => { status?: ConnectionRequestStatusValue; isOutgoing: boolean } | null;
  hasHydrated: boolean;
}>;

type StoredRequestsInbox = Readonly<{
  items: ReadonlyArray<RequestsInboxItem>;
}>;

const createDefaultState = (): StoredRequestsInbox => {
  return { items: [] };
};

const createPreview = (plaintext: string): string => {
  const normalized: string = plaintext.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 140)}…` : normalized;
};

export const useRequestsInbox = (params: UseRequestsInboxParams): UseRequestsInboxResult => {
  const publicKeyHexRef = useRef<PublicKeyHex | null>(params.publicKeyHex);
  useEffect(() => {
    publicKeyHexRef.current = params.publicKeyHex;
  }, [params.publicKeyHex]);

  const [stored, setStored] = useState<StoredRequestsInbox>(createDefaultState());
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect((): void => {
    if (!params.publicKeyHex) {
      setStored(createDefaultState());
      return;
    }
    const persisted = chatStateStoreService.load(params.publicKeyHex);
    if (persisted && persisted.connectionRequests) {
      setStored({
        items: persisted.connectionRequests.map(item => ({
          peerPublicKeyHex: item.id as PublicKeyHex,
          status: item.status,
          isOutgoing: item.isOutgoing,
          lastMessagePreview: item.introMessage || "",
          lastReceivedAtUnixSeconds: Math.floor((item.timestampMs || 0) / 1000),
          unreadCount: 0 // We don't persist unread specifically for requests right now, or we do?
        }))
      });
      setHasHydrated(true);
    } else {
      setHasHydrated(true); // Treat "no data" as hydrated too once check is done
    }
  }, [params.publicKeyHex]);

  const [processedEventIds] = useState<Set<string>>(() => new Set());

  const persistChange = useCallback((next: StoredRequestsInbox) => {
    const pk = publicKeyHexRef.current;
    if (pk) {
      chatStateStoreService.updateConnectionRequests(pk, next.items.map(item => ({
        id: item.peerPublicKeyHex,
        status: item.status || 'pending',
        isOutgoing: item.isOutgoing ?? false,
        introMessage: item.lastMessagePreview,
        timestampMs: item.lastReceivedAtUnixSeconds * 1000
      })));
    }
  }, []);

  const upsertIncoming = useCallback((p: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    plaintext: string;
    createdAtUnixSeconds: number;
    isRequest?: boolean;
    status?: ConnectionRequestStatusValue;
    eventId?: string;
  }>): void => {
    if (p.eventId) {
      if (processedEventIds.has(p.eventId)) return;
      processedEventIds.add(p.eventId);
    }

    const preview: string = createPreview(p.plaintext);
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const existing: RequestsInboxItem | undefined = prev.items.find((i: RequestsInboxItem): boolean => i.peerPublicKeyHex === p.peerPublicKeyHex);

      // Use state machine to check if we should process this as a new request
      if (existing && !shouldProcessAsNewRequest(existing.status)) {
        return prev;
      }

      let nextItems: RequestsInboxItem[];

      if (!existing) {
        const nextItem: RequestsInboxItem = {
          peerPublicKeyHex: p.peerPublicKeyHex,
          lastMessagePreview: preview,
          lastReceivedAtUnixSeconds: p.createdAtUnixSeconds,
          unreadCount: 1,
          isRequest: p.isRequest,
          status: p.status
        };
        nextItems = [nextItem, ...prev.items];
      } else {
        const isNewer = p.createdAtUnixSeconds > existing.lastReceivedAtUnixSeconds;
        const currentStatus = p.status ?? existing.status;
        const shouldIncrement = isNewer && (currentStatus === 'pending' || !currentStatus);
        const nextUnread: number = (currentStatus === 'pending' || !currentStatus)
          ? (shouldIncrement ? existing.unreadCount + 1 : existing.unreadCount)
          : 0;

        const updated: RequestsInboxItem = {
          peerPublicKeyHex: existing.peerPublicKeyHex,
          lastMessagePreview: isNewer ? preview : existing.lastMessagePreview,
          lastReceivedAtUnixSeconds: Math.floor(Math.max(existing.lastReceivedAtUnixSeconds, p.createdAtUnixSeconds)),
          unreadCount: nextUnread,
          isRequest: p.isRequest ?? existing.isRequest,
          status: p.status ?? existing.status
        };
        nextItems = [updated, ...prev.items.filter((i: RequestsInboxItem): boolean => i.peerPublicKeyHex !== p.peerPublicKeyHex)];
      }

      const pendingItems = nextItems.filter(i => i.status === 'pending' || !i.status);
      const handledItems = nextItems.filter(i => i.status !== 'pending' && i.status !== undefined);
      if (handledItems.length > 1) {
        handledItems.sort((a, b) => b.lastReceivedAtUnixSeconds - a.lastReceivedAtUnixSeconds);
        nextItems = [...pendingItems, handledItems[0]];
      }

      const next = { items: nextItems };
      persistChange(next);
      return next;
    });
  }, [processedEventIds, persistChange]);

  const remove = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const next = { items: prev.items.filter((i: RequestsInboxItem): boolean => i.peerPublicKeyHex !== p.peerPublicKeyHex) };
      persistChange(next);
      return next;
    });
  }, [persistChange]);

  const markRead = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const next = {
        items: prev.items.map((i: RequestsInboxItem): RequestsInboxItem => {
          if (i.peerPublicKeyHex !== p.peerPublicKeyHex) return i;
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
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const next = { items: [] };
      persistChange(next);
      return next;
    });
  }, [persistChange]);

  const setStatus = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: ConnectionRequestStatusValue; isOutgoing?: boolean }>): void => {
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const existing = prev.items.find(i => i.peerPublicKeyHex === p.peerPublicKeyHex);
      let nextItems: RequestsInboxItem[];

      if (!existing) {
        const nextState = transitionHandshake(
          { status: "none", isOutgoing: false },
          { type: p.isOutgoing ? "SEND_REQUEST" : "RECEIVE_REQUEST" }
        );

        const newItem: RequestsInboxItem = {
          peerPublicKeyHex: p.peerPublicKeyHex,
          lastMessagePreview: "",
          lastReceivedAtUnixSeconds: Math.floor(Date.now() / 1000),
          unreadCount: 0,
          status: nextState.status === "none" ? undefined : nextState.status,
          isOutgoing: nextState.isOutgoing
        };
        nextItems = [newItem, ...prev.items];
      } else {
        nextItems = prev.items.map((i: RequestsInboxItem): RequestsInboxItem => {
          if (i.peerPublicKeyHex !== p.peerPublicKeyHex) return i;

          const currentState: HandshakeState = {
            status: i.status || "none",
            isOutgoing: i.isOutgoing ?? false
          };

          let eventType: any = "RESET";
          if (p.status === "accepted") eventType = "ACCEPT";
          if (p.status === "declined") eventType = "DECLINE";
          if (p.status === "canceled") eventType = "CANCEL";
          if (p.status === "pending") eventType = p.isOutgoing ? "SEND_REQUEST" : "RECEIVE_REQUEST";

          const nextState = transitionHandshake(currentState, { type: eventType });
          const nextUnread = nextState.status === 'pending' ? i.unreadCount : 0;

          return {
            ...i,
            status: nextState.status === "none" ? undefined : nextState.status,
            unreadCount: nextUnread,
            isOutgoing: nextState.isOutgoing
          };
        });
      }

      const pendingItems = nextItems.filter(i => i.status === 'pending' || !i.status);
      const handledItems = nextItems.filter(i => i.status !== 'pending' && i.status !== undefined);
      if (handledItems.length > 1) {
        handledItems.sort((a, b) => b.lastReceivedAtUnixSeconds - a.lastReceivedAtUnixSeconds);
        nextItems = [...pendingItems, handledItems[0]];
      }

      const next = { items: nextItems };
      persistChange(next);
      return next;
    });
  }, [persistChange]);

  const state: RequestsInboxState = useMemo((): RequestsInboxState => {
    return { items: stored.items };
  }, [stored.items]);

  const getRequestStatus = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): { status?: ConnectionRequestStatusValue; isOutgoing: boolean } | null => {
    const item = stored.items.find(i => i.peerPublicKeyHex === p.peerPublicKeyHex);
    if (!item) return null;
    return { status: item.status, isOutgoing: item.isOutgoing || false };
  }, [stored.items]);

  return useMemo(
    () => ({ state, upsertIncoming, remove, markRead, markAllRead, clearHistory, setStatus, getRequestStatus, hasHydrated }),
    [state, upsertIncoming, remove, markRead, markAllRead, clearHistory, setStatus, getRequestStatus, hasHydrated]
  );
};
