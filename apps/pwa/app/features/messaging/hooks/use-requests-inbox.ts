"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

import type { ConnectionRequestStatusValue } from "@/app/features/messaging/types";
import { ConnectionRequestService } from "@/app/features/contacts/services/connection-request-service";

type RequestsInboxItem = Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  lastMessagePreview: string;
  lastReceivedAtUnixSeconds: number;
  unreadCount: number;
  status?: ConnectionRequestStatusValue;
  isRequest?: boolean;
}>;

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
  }>) => void;
  remove: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => void;
  markRead: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => void;
  setStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: ConnectionRequestStatusValue }>) => void;
}>;

type StoredRequestsInbox = Readonly<{
  items: ReadonlyArray<RequestsInboxItem>;
}>;

type RequestsStatusByPeer = Readonly<Record<string, ConnectionRequestStatusValue>>;

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
        const status = typeof c.status === "string" ? (c.status as ConnectionRequestStatusValue) : undefined;
        const isRequest = typeof c.isRequest === "boolean" ? c.isRequest : false;
        if (!peer) {
          return null;
        }
        return { peerPublicKeyHex: peer, lastMessagePreview, lastReceivedAtUnixSeconds, unreadCount, status, isRequest };
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
  const [statusByPeer, setStatusByPeer] = useState<RequestsStatusByPeer>({});
  useEffect((): void => {
    queueMicrotask((): void => {
      if (!params.publicKeyHex) {
        setStored(createDefaultState());
        setStatusByPeer({});
        return;
      }
      setStored(loadFromStorage(params.publicKeyHex));
    });
  }, [params.publicKeyHex]);
  useEffect(() => {
    if (!params.publicKeyHex) {
      return;
    }
    let isAlive = true;
    void ConnectionRequestService.getRequests(params.publicKeyHex).then((requests) => {
      if (!isAlive) {
        return;
      }
      const next: Record<string, ConnectionRequestStatusValue> = {};
      requests.forEach((r) => {
        next[r.id] = r.status;
      });
      setStatusByPeer(next);
    });
    return (): void => {
      isAlive = false;
    };
  }, [params.publicKeyHex]);
  useEffect((): void => {
    if (!params.publicKeyHex) {
      return;
    }
    saveToStorage(params.publicKeyHex, stored);
  }, [params.publicKeyHex, stored]);
  const upsertIncoming = useCallback((p: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    plaintext: string;
    createdAtUnixSeconds: number;
    isRequest?: boolean;
    status?: ConnectionRequestStatusValue;
  }>): void => {
    const preview: string = createPreview(p.plaintext);
    if (params.publicKeyHex && p.status) {
      void ConnectionRequestService.addRequest(params.publicKeyHex, {
        id: p.peerPublicKeyHex,
        status: p.status,
        isOutgoing: false,
        introMessage: undefined,
        timestamp: new Date(p.createdAtUnixSeconds * 1000)
      });
      setStatusByPeer((prev: RequestsStatusByPeer): RequestsStatusByPeer => ({ ...prev, [p.peerPublicKeyHex]: p.status as ConnectionRequestStatusValue }));
    }
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
        return { items: [nextItem, ...prev.items] };
      }
      const nextUnread: number = existing.unreadCount + 1;
      const updated: RequestsInboxItem = {
        peerPublicKeyHex: existing.peerPublicKeyHex,
        lastMessagePreview: preview,
        lastReceivedAtUnixSeconds: Math.max(existing.lastReceivedAtUnixSeconds, p.createdAtUnixSeconds),
        unreadCount: nextUnread,
        isRequest: p.isRequest ?? existing.isRequest,
        status: p.status ?? existing.status
      };
      const nextItems: RequestsInboxItem[] = [updated, ...prev.items.filter((i: RequestsInboxItem): boolean => i.peerPublicKeyHex !== p.peerPublicKeyHex)];
      return { items: nextItems };
    });
  }, [params.publicKeyHex]);
  const remove = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
    if (params.publicKeyHex) {
      void ConnectionRequestService.updateRequestStatus(params.publicKeyHex, p.peerPublicKeyHex, "declined");
      setStatusByPeer((prev: RequestsStatusByPeer): RequestsStatusByPeer => ({ ...prev, [p.peerPublicKeyHex]: "declined" }));
    }
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      return { items: prev.items.filter((i: RequestsInboxItem): boolean => i.peerPublicKeyHex !== p.peerPublicKeyHex) };
    });
  }, [params.publicKeyHex]);
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
  const setStatus = useCallback((p: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: ConnectionRequestStatusValue }>): void => {
    if (params.publicKeyHex) {
      void ConnectionRequestService.updateRequestStatus(params.publicKeyHex, p.peerPublicKeyHex, p.status);
      setStatusByPeer((prev: RequestsStatusByPeer): RequestsStatusByPeer => ({ ...prev, [p.peerPublicKeyHex]: p.status }));
    }
    setStored((prev: StoredRequestsInbox): StoredRequestsInbox => {
      return {
        items: prev.items.map((i: RequestsInboxItem): RequestsInboxItem => {
          if (i.peerPublicKeyHex !== p.peerPublicKeyHex) {
            return i;
          }
          return { ...i, status: p.status };
        })
      };
    });
  }, [params.publicKeyHex]);
  const state: RequestsInboxState = useMemo((): RequestsInboxState => {
    const items: RequestsInboxItem[] = stored.items.map((i: RequestsInboxItem): RequestsInboxItem => {
      const status: ConnectionRequestStatusValue | undefined = statusByPeer[i.peerPublicKeyHex];
      if (!status) {
        return i;
      }
      return { ...i, status };
    });
    return { items };
  }, [statusByPeer, stored.items]);
  return { state, upsertIncoming, remove, markRead, setStatus };
};
