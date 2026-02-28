"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { chatStateStoreService as chatStateStore } from "@/app/features/messaging/services/chat-state-store";

type PeerTrustState = Readonly<{
  acceptedPeers: ReadonlyArray<PublicKeyHex>;
  mutedPeers: ReadonlyArray<PublicKeyHex>;
}>;

type UsePeerTrustParams = Readonly<{
  publicKeyHex: PublicKeyHex | null;
}>;

type UsePeerTrustResult = Readonly<{
  state: PeerTrustState;
  isAccepted: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
  isMuted: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
  mutePeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  unmutePeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  acceptPeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  unacceptPeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  hasHydrated: boolean;
}>;

type StoredPeerTrust = Readonly<{
  acceptedPeers: ReadonlyArray<PublicKeyHex>;
  mutedPeers: ReadonlyArray<PublicKeyHex>;
}>;

const createDefaultState = (): StoredPeerTrust => {
  return { acceptedPeers: [], mutedPeers: [] };
};

const getStorageKey = (publicKeyHex: PublicKeyHex): string => {
  return `obscur.peer_trust.v1.${publicKeyHex}`;
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

const loadFromStorage = (publicKeyHex: PublicKeyHex): StoredPeerTrust => {
  if (typeof window === "undefined") {
    return createDefaultState();
  }
  try {
    const raw: string | null = window.localStorage.getItem(getStorageKey(publicKeyHex));
    if (shouldDebugPersistence()) {
      console.info("[peerTrust] load", getStorageKey(publicKeyHex), raw ? raw.length : 0);
    }
    if (!raw) {
      return createDefaultState();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return createDefaultState();
    }
    const record = parsed as Record<string, unknown>;
    const accepted = Array.isArray(record.acceptedPeers) ? (record.acceptedPeers as unknown[]) : [];
    const muted = Array.isArray(record.mutedPeers) ? (record.mutedPeers as unknown[]) : [];
    const acceptedPeers: PublicKeyHex[] = accepted.filter((v: unknown): v is PublicKeyHex => typeof v === "string");
    const mutedPeers: PublicKeyHex[] = muted.filter((v: unknown): v is PublicKeyHex => typeof v === "string");
    return { acceptedPeers, mutedPeers };
  } catch {
    return createDefaultState();
  }
};

const saveToStorage = (publicKeyHex: PublicKeyHex, value: StoredPeerTrust): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const serialized = JSON.stringify(value);
    window.localStorage.setItem(getStorageKey(publicKeyHex), serialized);
    if (shouldDebugPersistence()) {
      console.info("[peerTrust] save", getStorageKey(publicKeyHex), serialized.length);
    }
  } catch {
    return;
  }
};

export const usePeerTrust = (params: UsePeerTrustParams): UsePeerTrustResult => {
  const publicKeyHexRef = useRef<PublicKeyHex | null>(params.publicKeyHex);
  useEffect(() => {
    publicKeyHexRef.current = params.publicKeyHex;
  }, [params.publicKeyHex]);

  const [stored, setStored] = useState<StoredPeerTrust>(() => {
    if (!params.publicKeyHex) {
      return createDefaultState();
    }
    return loadFromStorage(params.publicKeyHex);
  });
  const didLoadRef = useRef(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect((): void => {
    queueMicrotask((): void => {
      if (!params.publicKeyHex) {
        return;
      }
      const loaded = loadFromStorage(params.publicKeyHex);
      setStored(loaded);
      setHasHydrated(true);
    });
  }, [params.publicKeyHex]);

  useEffect((): void => {
    if (!params.publicKeyHex) {
      return;
    }
    if (stored.acceptedPeers.length > 0) {
      return;
    }
    const persisted = chatStateStore.load(params.publicKeyHex);
    const connectionRequests = persisted?.connectionRequests ?? [];
    const acceptedFromChat: PublicKeyHex[] = connectionRequests
      .filter((cr: any) => cr.status === "accepted")
      .map((cr: any) => cr.id as PublicKeyHex)
      .filter((v: unknown): v is PublicKeyHex => typeof v === "string" && v.trim().length > 0);

    if (acceptedFromChat.length === 0) {
      return;
    }

    queueMicrotask(() => {
      setStored((prev: StoredPeerTrust): StoredPeerTrust => {
        if (prev.acceptedPeers.length > 0) {
          return prev;
        }
        const merged = Array.from(new Set([...prev.acceptedPeers, ...acceptedFromChat]));
        const next: StoredPeerTrust = { acceptedPeers: merged, mutedPeers: prev.mutedPeers };
        saveToStorage(params.publicKeyHex as PublicKeyHex, next);
        return next;
      });
    });
  }, [params.publicKeyHex, stored.acceptedPeers.length]);

  useEffect((): void => {
    if (!params.publicKeyHex || !hasHydrated) {
      return;
    }

    // Skip the very first render after hydration to avoid saving the same thing we just loaded
    if (!didLoadRef.current) {
      didLoadRef.current = true;
      return;
    }

    saveToStorage(params.publicKeyHex, stored);
  }, [params.publicKeyHex, stored]);
  const isAccepted = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): boolean => {
    return stored.acceptedPeers.includes(p.publicKeyHex);
  }, [stored.acceptedPeers]);
  const isMuted = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): boolean => {
    return stored.mutedPeers.includes(p.publicKeyHex);
  }, [stored.mutedPeers]);
  const mutePeer = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      if (prev.mutedPeers.includes(p.publicKeyHex)) {
        return prev;
      }
      const next: StoredPeerTrust = { ...prev, mutedPeers: [...prev.mutedPeers, p.publicKeyHex] };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      return next;
    });
  }, []);
  const unmutePeer = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      const next: StoredPeerTrust = { ...prev, mutedPeers: prev.mutedPeers.filter((v: PublicKeyHex): boolean => v !== p.publicKeyHex) };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      return next;
    });
  }, []);
  const acceptPeer = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      if (prev.acceptedPeers.includes(p.publicKeyHex)) {
        return prev;
      }
      const nextAccepted: ReadonlyArray<PublicKeyHex> = [...prev.acceptedPeers, p.publicKeyHex];
      const nextMuted: ReadonlyArray<PublicKeyHex> = prev.mutedPeers.filter((v: PublicKeyHex): boolean => v !== p.publicKeyHex);
      const next: StoredPeerTrust = { acceptedPeers: nextAccepted, mutedPeers: nextMuted };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      return next;
    });
  }, []);
  const unacceptPeer = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      const next: StoredPeerTrust = { ...prev, acceptedPeers: prev.acceptedPeers.filter((v: PublicKeyHex): boolean => v !== p.publicKeyHex) };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      return next;
    });
  }, []);
  const state: PeerTrustState = useMemo((): PeerTrustState => {
    return { acceptedPeers: stored.acceptedPeers, mutedPeers: stored.mutedPeers };
  }, [stored.acceptedPeers, stored.mutedPeers]);
  return useMemo(
    () => ({ state, isAccepted, isMuted, mutePeer, unmutePeer, acceptPeer, unacceptPeer, hasHydrated }),
    [state, isAccepted, isMuted, mutePeer, unmutePeer, acceptPeer, unacceptPeer, hasHydrated]
  );
};
