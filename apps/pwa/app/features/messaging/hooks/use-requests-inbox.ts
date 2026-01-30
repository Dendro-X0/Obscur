"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type RequestsInboxItem = Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  lastMessagePreview: string;
  lastReceivedAtUnixSeconds: number;
  unreadCount: number;
}>;

type RequestsInboxState = Readonly<{
  items: ReadonlyArray<RequestsInboxItem>;
}>;

type UseRequestsInboxParams = Readonly<{
  publicKeyHex: PublicKeyHex | null;
}>;

type UseRequestsInboxResult = Readonly<{
  state: RequestsInboxState;
  upsertIncoming: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex; plaintext: string; createdAtUnixSeconds: number }>) => void;
  remove: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => void;
  markRead: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => void;
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

const loadFromStorage = (publicKeyHex: PublicKeyHex): StoredRequestsInbox => {
  if (typeof window === "undefined") {
    return createDefaultState();
  }
  try {
    const raw: string | null = window.localStorage.getItem(getStorageKey(publicKeyHex));
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
        if (!peer) {
          return null;
        }
        return { peerPublicKeyHex: peer, lastMessagePreview, lastReceivedAtUnixSeconds, unreadCount };
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
    window.localStorage.setItem(getStorageKey(publicKeyHex), JSON.stringify(value));
  } catch {
    return;
  }
};

const createPreview = (plaintext: string): string => {
  const normalized: string = plaintext.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 140)}…` : normalized;
};

export const useRequestsInbox = (params: UseRequestsInboxParams): UseRequestsInboxResult => {
  const [stored, setStored] = useState<StoredRequestsInbox>(() => {
    if (!params.publicKeyHex) {
      return createDefaultState();
    }
    return loadFromStorage(params.publicKeyHex);
  });
  useEffect((): void => {
    queueMicrotask((): void => {
      if (!params.publicKeyHex) {
        setStored(createDefaultState());
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
  const upsertIncoming = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex; plaintext: string; createdAtUnixSeconds: number }>): void => {
    const preview: string = createPreview(p.plaintext);
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      const existing: RequestsInboxItem | undefined = prev.items.find((i: RequestsInboxItem): boolean => i.peerPublicKeyHex === p.peerPublicKeyHex);
      if (!existing) {
        const nextItem: RequestsInboxItem = {
          peerPublicKeyHex: p.peerPublicKeyHex,
          lastMessagePreview: preview,
          lastReceivedAtUnixSeconds: p.createdAtUnixSeconds,
          unreadCount: 1,
        };
        return { items: [nextItem, ...prev.items] };
      }
      const nextUnread: number = existing.unreadCount + 1;
      const updated: RequestsInboxItem = {
        peerPublicKeyHex: existing.peerPublicKeyHex,
        lastMessagePreview: preview,
        lastReceivedAtUnixSeconds: Math.max(existing.lastReceivedAtUnixSeconds, p.createdAtUnixSeconds),
        unreadCount: nextUnread,
      };
      const nextItems: RequestsInboxItem[] = [updated, ...prev.items.filter((i: RequestsInboxItem): boolean => i.peerPublicKeyHex !== p.peerPublicKeyHex)];
      return { items: nextItems };
    });
  }, []);
  const remove = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      return { items: prev.items.filter((i: RequestsInboxItem): boolean => i.peerPublicKeyHex !== p.peerPublicKeyHex) };
    });
  }, []);
  const markRead = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      return {
        items: prev.items.map((i: RequestsInboxItem): RequestsInboxItem => {
          if (i.peerPublicKeyHex !== p.peerPublicKeyHex) {
            return i;
          }
          return { ...i, unreadCount: 0 };
        })
      };
    });
  }, []);
  const state: RequestsInboxState = useMemo((): RequestsInboxState => {
    return { items: stored.items };
  }, [stored.items]);
  return { state, upsertIncoming, remove, markRead };
};
