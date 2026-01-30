"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

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

const loadFromStorage = (publicKeyHex: PublicKeyHex): StoredPeerTrust => {
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
    window.localStorage.setItem(getStorageKey(publicKeyHex), JSON.stringify(value));
  } catch {
    return;
  }
};

export const usePeerTrust = (params: UsePeerTrustParams): UsePeerTrustResult => {
  const [stored, setStored] = useState<StoredPeerTrust>(() => {
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
      return { ...prev, mutedPeers: [...prev.mutedPeers, p.publicKeyHex] };
    });
  }, []);
  const unmutePeer = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      return { ...prev, mutedPeers: prev.mutedPeers.filter((v: PublicKeyHex): boolean => v !== p.publicKeyHex) };
    });
  }, []);
  const acceptPeer = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      if (prev.acceptedPeers.includes(p.publicKeyHex)) {
        return prev;
      }
      const nextAccepted: ReadonlyArray<PublicKeyHex> = [...prev.acceptedPeers, p.publicKeyHex];
      const nextMuted: ReadonlyArray<PublicKeyHex> = prev.mutedPeers.filter((v: PublicKeyHex): boolean => v !== p.publicKeyHex);
      return { acceptedPeers: nextAccepted, mutedPeers: nextMuted };
    });
  }, []);
  const unacceptPeer = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      return { ...prev, acceptedPeers: prev.acceptedPeers.filter((v: PublicKeyHex): boolean => v !== p.publicKeyHex) };
    });
  }, []);
  const state: PeerTrustState = useMemo((): PeerTrustState => {
    return { acceptedPeers: stored.acceptedPeers, mutedPeers: stored.mutedPeers };
  }, [stored.acceptedPeers, stored.mutedPeers]);
  return { state, isAccepted, isMuted, mutePeer, unmutePeer, acceptPeer, unacceptPeer };
};
