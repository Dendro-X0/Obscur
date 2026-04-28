"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { chatStateStoreService as chatStateStore } from "@/app/features/messaging/services/chat-state-store";
import type { PersistedChatState } from "@/app/features/messaging/types";
import { normalizePublicKeyHex, normalizePublicKeyHexList } from "@/app/features/profile/utils/normalize-public-key-hex";
import { getActiveProfileIdSafe, getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { appendCanonicalContactEvent } from "@/app/features/account-sync/services/account-event-ingest-bridge";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { resolveProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import { selectProjectionAcceptedPeers } from "@/app/features/account-sync/services/account-projection-selectors";
import { shouldWriteLegacyContactsDm } from "@/app/features/account-sync/services/account-sync-migration-policy";
import { CHAT_STATE_REPLACED_EVENT } from "@/app/features/messaging/services/chat-state-store";

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

const createContactMutationIdempotencySuffix = (params: Readonly<{
  action: "accept" | "unaccept";
  peerPublicKeyHex: PublicKeyHex;
  atUnixMs: number;
  nonce: number;
}>): string => (
  `${params.action}:${params.peerPublicKeyHex}:${params.atUnixMs}:${params.nonce}`
);

const getStorageKey = (publicKeyHex: PublicKeyHex): string => {
  return `obscur.peer_trust.v1.${publicKeyHex}`;
};

const DEBUG_PERSISTENCE_KEY = "obscur_debug_persistence";
const getDebugPersistenceKey = (): string => getScopedStorageKey(DEBUG_PERSISTENCE_KEY);

const shouldDebugPersistence = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return (window.localStorage.getItem(getDebugPersistenceKey()) ?? window.localStorage.getItem(DEBUG_PERSISTENCE_KEY)) === "1";
  } catch {
    return false;
  }
};

const removeSelfFromTrustState = (publicKeyHex: PublicKeyHex, value: StoredPeerTrust): StoredPeerTrust => {
  return {
    acceptedPeers: value.acceptedPeers.filter((peer) => peer !== publicKeyHex),
    mutedPeers: value.mutedPeers.filter((peer) => peer !== publicKeyHex),
  };
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
    const acceptedPeers = normalizePublicKeyHexList(accepted.filter((v: unknown): v is string => typeof v === "string"));
    const mutedPeers = normalizePublicKeyHexList(muted.filter((v: unknown): v is string => typeof v === "string"));
    return removeSelfFromTrustState(publicKeyHex, { acceptedPeers, mutedPeers });
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

const extractAcceptedPeersFromPersistedChatState = (
  persisted: PersistedChatState | null | undefined,
): ReadonlyArray<PublicKeyHex> => {
  if (!persisted) {
    return [];
  }

  const acceptedFromRequests: ReadonlyArray<PublicKeyHex> = (persisted.connectionRequests ?? [])
    .filter((request) => request.status === "accepted")
    .map((request) => normalizePublicKeyHex(request.id))
    .filter((peer): peer is PublicKeyHex => peer !== null);

  const acceptedFromConnections: ReadonlyArray<PublicKeyHex> = (persisted.createdConnections ?? [])
    .map((connection) => normalizePublicKeyHex(connection.pubkey))
    .filter((peer): peer is PublicKeyHex => peer !== null);

  return Array.from(new Set([...acceptedFromRequests, ...acceptedFromConnections]));
};

export const usePeerTrust = (params: UsePeerTrustParams): UsePeerTrustResult => {
  const projectionSnapshot = useAccountProjectionSnapshot();
  const activeProfileId = getActiveProfileIdSafe();
  const projectionReadAuthority = useMemo(() => (
    resolveProjectionReadAuthority({
      projectionSnapshot,
      expectedProfileId: activeProfileId,
      expectedAccountPublicKeyHex: params.publicKeyHex,
    })
  ), [activeProfileId, params.publicKeyHex, projectionSnapshot]);
  const projectionAcceptedPeers = useMemo(
    () => selectProjectionAcceptedPeers(projectionSnapshot.projection),
    [projectionSnapshot.projection]
  );
  const shouldUseProjectionReads = projectionReadAuthority.useProjectionReads;
  const shouldWriteLegacyContacts = shouldWriteLegacyContactsDm(projectionReadAuthority.policy);

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
  const contactMutationNonceRef = useRef(0);
  const hydrateAcceptedPeersFromChatState = useCallback((): void => {
    const currentPublicKeyHex = publicKeyHexRef.current;
    if (!currentPublicKeyHex) {
      return;
    }
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      if (prev.acceptedPeers.length > 0) {
        return prev;
      }
      const persisted = chatStateStore.load(currentPublicKeyHex);
      const acceptedFromChat: ReadonlyArray<PublicKeyHex> = extractAcceptedPeersFromPersistedChatState(persisted);
      if (acceptedFromChat.length === 0) {
        return prev;
      }
      const merged = Array.from(new Set([...prev.acceptedPeers, ...acceptedFromChat]));
      const next: StoredPeerTrust = removeSelfFromTrustState(
        currentPublicKeyHex,
        { acceptedPeers: merged, mutedPeers: prev.mutedPeers }
      );
      saveToStorage(currentPublicKeyHex, next);
      return next;
    });
  }, []);

  const nextContactMutationSuffix = useCallback((params: Readonly<{
    action: "accept" | "unaccept";
    peerPublicKeyHex: PublicKeyHex;
  }>): string => {
    contactMutationNonceRef.current += 1;
    return createContactMutationIdempotencySuffix({
      action: params.action,
      peerPublicKeyHex: params.peerPublicKeyHex,
      atUnixMs: Date.now(),
      nonce: contactMutationNonceRef.current,
    });
  }, []);

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
    queueMicrotask(() => {
      hydrateAcceptedPeersFromChatState();
    });
  }, [hydrateAcceptedPeersFromChatState, params.publicKeyHex, stored.acceptedPeers.length]);

  useEffect(() => {
    if (typeof window === "undefined" || !params.publicKeyHex) {
      return;
    }
    const onChatStateReplaced = (event: Event): void => {
      const detail = (event as CustomEvent<{ publicKeyHex?: string; profileId?: string }>).detail;
      const restoredPublicKeyHex = normalizePublicKeyHex(detail?.publicKeyHex);
      if (restoredPublicKeyHex && restoredPublicKeyHex !== params.publicKeyHex) {
        return;
      }
      if (detail?.profileId && detail.profileId !== getActiveProfileIdSafe()) {
        return;
      }
      hydrateAcceptedPeersFromChatState();
    };
    window.addEventListener(CHAT_STATE_REPLACED_EVENT, onChatStateReplaced);
    return () => {
      window.removeEventListener(CHAT_STATE_REPLACED_EVENT, onChatStateReplaced);
    };
  }, [hydrateAcceptedPeersFromChatState, params.publicKeyHex]);

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
  const acceptedPeersForRead = shouldUseProjectionReads ? projectionAcceptedPeers : stored.acceptedPeers;

  const isAccepted = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): boolean => {
    const normalized = normalizePublicKeyHex(p.publicKeyHex);
    if (!normalized) return false;
    return acceptedPeersForRead.includes(normalized);
  }, [acceptedPeersForRead]);
  const isMuted = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): boolean => {
    const normalized = normalizePublicKeyHex(p.publicKeyHex);
    if (!normalized) return false;
    return stored.mutedPeers.includes(normalized);
  }, [stored.mutedPeers]);
  const mutePeer = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    const normalized = normalizePublicKeyHex(p.publicKeyHex);
    if (!normalized) return;
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      if (prev.mutedPeers.includes(normalized)) {
        return prev;
      }
      const next: StoredPeerTrust = { ...prev, mutedPeers: [...prev.mutedPeers, normalized] };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      emitAccountSyncMutation("peer_trust_changed");
      return next;
    });
  }, []);
  const unmutePeer = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    const normalized = normalizePublicKeyHex(p.publicKeyHex);
    if (!normalized) return;
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      if (!prev.mutedPeers.includes(normalized)) {
        return prev;
      }
      const next: StoredPeerTrust = { ...prev, mutedPeers: prev.mutedPeers.filter((v: PublicKeyHex): boolean => v !== normalized) };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      emitAccountSyncMutation("peer_trust_changed");
      return next;
    });
  }, []);
  const acceptPeer = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    const normalized = normalizePublicKeyHex(p.publicKeyHex);
    if (!normalized) return;
    const currentProfilePublicKeyHex = publicKeyHexRef.current;
    if (currentProfilePublicKeyHex && normalized === currentProfilePublicKeyHex) {
      return;
    }
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      if (!shouldWriteLegacyContacts) {
        const nextMuted = prev.mutedPeers.filter((v: PublicKeyHex): boolean => v !== normalized);
        if (nextMuted.length === prev.mutedPeers.length) {
          return prev;
        }
        const next: StoredPeerTrust = { ...prev, mutedPeers: nextMuted };
        const pk = publicKeyHexRef.current;
        if (pk) {
          saveToStorage(pk, next);
        }
        return next;
      }
      if (prev.acceptedPeers.includes(normalized)) {
        return prev;
      }
      const nextAccepted: ReadonlyArray<PublicKeyHex> = [...prev.acceptedPeers, normalized];
      const nextMuted: ReadonlyArray<PublicKeyHex> = prev.mutedPeers.filter((v: PublicKeyHex): boolean => v !== normalized);
      const next: StoredPeerTrust = { acceptedPeers: nextAccepted, mutedPeers: nextMuted };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      emitAccountSyncMutation("peer_trust_changed");
      return next;
    });
    if (currentProfilePublicKeyHex) {
      void appendCanonicalContactEvent({
        accountPublicKeyHex: currentProfilePublicKeyHex,
        peerPublicKeyHex: normalized,
        type: "CONTACT_ACCEPTED",
        direction: "unknown",
        idempotencySuffix: nextContactMutationSuffix({
          action: "accept",
          peerPublicKeyHex: normalized,
        }),
        source: "legacy_bridge",
      });
    }
  }, [nextContactMutationSuffix, shouldWriteLegacyContacts]);
  const unacceptPeer = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    const normalized = normalizePublicKeyHex(p.publicKeyHex);
    if (!normalized) return;
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      if (!shouldWriteLegacyContacts) {
        return prev;
      }
      if (!prev.acceptedPeers.includes(normalized)) {
        return prev;
      }
      const next: StoredPeerTrust = { ...prev, acceptedPeers: prev.acceptedPeers.filter((v: PublicKeyHex): boolean => v !== normalized) };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next);
      }
      emitAccountSyncMutation("peer_trust_changed");
      return next;
    });
    const currentProfilePublicKeyHex = publicKeyHexRef.current;
    if (currentProfilePublicKeyHex) {
      void appendCanonicalContactEvent({
        accountPublicKeyHex: currentProfilePublicKeyHex,
        peerPublicKeyHex: normalized,
        type: "CONTACT_REMOVED",
        direction: "unknown",
        idempotencySuffix: nextContactMutationSuffix({
          action: "unaccept",
          peerPublicKeyHex: normalized,
        }),
        source: "legacy_bridge",
      });
    }
  }, [nextContactMutationSuffix, shouldWriteLegacyContacts]);
  const state: PeerTrustState = useMemo((): PeerTrustState => {
    return {
      acceptedPeers: acceptedPeersForRead,
      mutedPeers: stored.mutedPeers,
    };
  }, [acceptedPeersForRead, stored.mutedPeers]);
  return useMemo(
    () => ({ state, isAccepted, isMuted, mutePeer, unmutePeer, acceptPeer, unacceptPeer, hasHydrated }),
    [state, isAccepted, isMuted, mutePeer, unmutePeer, acceptPeer, unacceptPeer, hasHydrated]
  );
};

export const peerTrustInternals = {
  createDefaultState,
  createContactMutationIdempotencySuffix,
  getStorageKey,
  loadFromStorage,
  saveToStorage,
  extractAcceptedPeersFromPersistedChatState,
};
