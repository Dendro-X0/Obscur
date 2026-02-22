"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

import type { ConnectionRequestStatusValue, RequestsInboxItem } from "@/app/features/messaging/types";



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
}>;

type StoredRequestsInbox = Readonly<{
  items: ReadonlyArray<RequestsInboxItem>;
}>;

const createDefaultState = (): StoredRequestsInbox => {
  return { items: [] };
};

const getStorageKey = (publicKeyHex: PublicKeyHex): string => {
  return `obscur.requests_inbox.v1.${publicKeyHex}`;
};

const shouldDebugPersistence = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem("obscur_debug_persistence") === "1";
  } catch {
    return false;
  }
};

const loadFromStorage = (publicKeyHex: PublicKeyHex): StoredRequestsInbox => {
  if (typeof window === "undefined") {
    return createDefaultState();
  }
  try {
    const raw: string | null = window.localStorage.getItem(getStorageKey(publicKeyHex));
    if (shouldDebugPersistence()) {
      console.info("[requestsInbox] load", getStorageKey(publicKeyHex), raw ? raw.length : 0);
    }
    if (!raw) {
      return createDefaultState();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return createDefaultState();
    }
    const record = parsed as Record<string, unknown>;
    const itemsRaw: unknown = record.items;
    if (!Array.isArray(itemsRaw)) {
      return createDefaultState();
    }
    const items: RequestsInboxItem[] = itemsRaw
      .map((candidate: unknown): RequestsInboxItem | null => {
        if (!candidate || typeof candidate !== "object") {
          return null;
        }
        const c = candidate as Record<string, unknown>;
        const peer = typeof c.peerPublicKeyHex === "string" ? (c.peerPublicKeyHex as PublicKeyHex) : null;
        const lastMessagePreview = typeof c.lastMessagePreview === "string" ? c.lastMessagePreview : "";
        const lastReceivedAtUnixSeconds = typeof c.lastReceivedAtUnixSeconds === "number" ? c.lastReceivedAtUnixSeconds : 0;
        const unreadCount = typeof c.unreadCount === "number" ? c.unreadCount : 0;
        const status = typeof c.status === "string" ? (c.status as ConnectionRequestStatusValue) : undefined;
        const isRequest = typeof c.isRequest === "boolean" ? c.isRequest : false;
        const isOutgoing = typeof c.isOutgoing === "boolean" ? c.isOutgoing : false;
        if (!peer) {
          return null;
        }
        return { peerPublicKeyHex: peer, lastMessagePreview, lastReceivedAtUnixSeconds, unreadCount, status, isRequest, isOutgoing };
      })
      .filter((v: RequestsInboxItem | null): v is RequestsInboxItem => v !== null);
    return { items };
  } catch {
    return createDefaultState();
  }
};

const saveToStorage = (publicKeyHex: PublicKeyHex, value: StoredRequestsInbox): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const serialized = JSON.stringify(value);
    window.localStorage.setItem(getStorageKey(publicKeyHex), serialized);
    if (shouldDebugPersistence()) {
      console.info("[requestsInbox] save", getStorageKey(publicKeyHex), serialized.length);
    }
  } catch {
    return;
  }
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

  const [stored, setStored] = useState<StoredRequestsInbox>(() => {
    if (!params.publicKeyHex) {
      return createDefaultState();
    }
    return loadFromStorage(params.publicKeyHex);
  });
  useEffect((): void => {
    queueMicrotask((): void => {
      if (!params.publicKeyHex) {
        return;
      }
      setStored(loadFromStorage(params.publicKeyHex));
    });
  }, [params.publicKeyHex]);
  useEffect((): void => {
    if (!params.publicKeyHex) {
      return;
    }
    saveToStorage(params.publicKeyHex, stored);
  }, [params.publicKeyHex, stored]);
  const [processedEventIds] = useState<Set<string>>(() => new Set());

  const upsertIncoming = useCallback((p: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    plaintext: string;
    createdAtUnixSeconds: number;
    isRequest?: boolean;
    status?: ConnectionRequestStatusValue;
    eventId?: string;
  }>): void => {
    // Basic deduplication if eventId is provided
    if (p.eventId) {
      if (processedEventIds.has(p.eventId)) {
        return;
      }
      processedEventIds.add(p.eventId);
    }

    const preview: string = createPreview(p.plaintext);
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const existing: RequestsInboxItem | undefined = prev.items.find((i: RequestsInboxItem): boolean => i.peerPublicKeyHex === p.peerPublicKeyHex);
      if (!existing) {
        const nextItem: RequestsInboxItem = {
          peerPublicKeyHex: p.peerPublicKeyHex,
          lastMessagePreview: preview,
          lastReceivedAtUnixSeconds: p.createdAtUnixSeconds,
          unreadCount: 1,
          isRequest: p.isRequest,
          status: p.status
        };
        const next: StoredRequestsInbox = { items: [nextItem, ...prev.items] };
        const pk = publicKeyHexRef.current;
        if (pk) {
          saveToStorage(pk, next);
        }
        return next;
      }

      // If we've seen a more recent message, update preview and increment count
      const isNewer = p.createdAtUnixSeconds > existing.lastReceivedAtUnixSeconds;

      // Only increment unread if the request is still pending or if it's a new request for a previously declined contact
      const currentStatus = p.status ?? existing.status;
      const shouldIncrement = isNewer && (currentStatus === 'pending' || !currentStatus);

      // Clear unreadCount if the status is already resolved
      const nextUnread: number = (currentStatus === 'pending' || !currentStatus)
        ? (shouldIncrement ? existing.unreadCount + 1 : existing.unreadCount)
        : 0;

      const updated: RequestsInboxItem = {
        peerPublicKeyHex: existing.peerPublicKeyHex,
        lastMessagePreview: isNewer ? preview : existing.lastMessagePreview,
        lastReceivedAtUnixSeconds: Math.max(existing.lastReceivedAtUnixSeconds, p.createdAtUnixSeconds),
        unreadCount: nextUnread,
        isRequest: p.isRequest ?? existing.isRequest,
        status: p.status ?? existing.status
      };

      let nextItems: RequestsInboxItem[] = [updated, ...prev.items.filter((i: RequestsInboxItem): boolean => i.peerPublicKeyHex !== p.peerPublicKeyHex)];

      // Limit history: only keep latest handled (non-pending) request
      const pendingItems = nextItems.filter(i => i.status === 'pending' || !i.status);
      const handledItems = nextItems.filter(i => i.status !== 'pending' && i.status !== undefined);

      if (handledItems.length > 1) {
        // Sort by time and keep only the newest
        handledItems.sort((a, b) => b.lastReceivedAtUnixSeconds - a.lastReceivedAtUnixSeconds);
        nextItems = [...pendingItems, handledItems[0]];
      }

      const next: StoredRequestsInbox = { items: nextItems };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      return next;
    });
  }, [processedEventIds]);
  const remove = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const next: StoredRequestsInbox = { items: prev.items.filter((i: RequestsInboxItem): boolean => i.peerPublicKeyHex !== p.peerPublicKeyHex) };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      return next;
    });
  }, []);
  const markRead = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const next: StoredRequestsInbox = {
        items: prev.items.map((i: RequestsInboxItem): RequestsInboxItem => {
          if (i.peerPublicKeyHex !== p.peerPublicKeyHex) {
            return i;
          }
          return { ...i, unreadCount: 0 };
        })
      };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      return next;
    });
  }, []);
  const markAllRead = useCallback((): void => {
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const next: StoredRequestsInbox = {
        items: prev.items.map((i: RequestsInboxItem): RequestsInboxItem => ({ ...i, unreadCount: 0 }))
      };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      return next;
    });
  }, []);
  const clearHistory = useCallback((): void => {
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const next: StoredRequestsInbox = { items: [] };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      return next;
    });
  }, []);
  const setStatus = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: ConnectionRequestStatusValue; isOutgoing?: boolean }>): void => {
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const existing = prev.items.find(i => i.peerPublicKeyHex === p.peerPublicKeyHex);
      if (!existing) {
        const newItem: RequestsInboxItem = {
          peerPublicKeyHex: p.peerPublicKeyHex,
          lastMessagePreview: "", // No preview for manually removed contacts
          lastReceivedAtUnixSeconds: Math.floor(Date.now() / 1000),
          unreadCount: 0,
          status: p.status,
          isOutgoing: p.isOutgoing
        };
        const next: StoredRequestsInbox = { items: [newItem, ...prev.items] };
        const pk = publicKeyHexRef.current;
        if (pk) {
          saveToStorage(pk, next);
        }
        return next;
      }
      const nextItems = prev.items.map((i: RequestsInboxItem): RequestsInboxItem => {
        if (i.peerPublicKeyHex !== p.peerPublicKeyHex) {
          return i;
        }
        // Clear unread count when status changes to anything other than pending
        const nextUnread = p.status === 'pending' ? i.unreadCount : 0;
        return { ...i, status: p.status, unreadCount: nextUnread, isOutgoing: p.isOutgoing ?? i.isOutgoing };
      });

      // Limit history: only keep latest handled (non-pending) request
      const pendingItems = nextItems.filter(i => i.status === 'pending' || !i.status);
      const handledItems = nextItems.filter(i => i.status !== 'pending' && i.status !== undefined);

      if (handledItems.length > 1) {
        handledItems.sort((a, b) => b.lastReceivedAtUnixSeconds - a.lastReceivedAtUnixSeconds);
        const next: StoredRequestsInbox = { items: [...pendingItems, handledItems[0]] };
        const pk = publicKeyHexRef.current;
        if (pk) {
          saveToStorage(pk, next);
        }
        return next;
      }

      const next: StoredRequestsInbox = { items: nextItems };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      return next;
    });
  }, []);
  const state: RequestsInboxState = useMemo((): RequestsInboxState => {
    return { items: stored.items };
  }, [stored.items]);
  const getRequestStatus = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): { status?: ConnectionRequestStatusValue; isOutgoing: boolean } | null => {
    const item = stored.items.find(i => i.peerPublicKeyHex === p.peerPublicKeyHex);
    if (!item) return null;
    return { status: item.status, isOutgoing: item.isOutgoing || false };
  }, [stored.items]);

  return { state, upsertIncoming, remove, markRead, markAllRead, clearHistory, setStatus, getRequestStatus };
};
