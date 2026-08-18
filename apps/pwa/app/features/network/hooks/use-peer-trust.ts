"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { messagingChatStateReadPort } from "@/app/features/messaging/services/messaging-chat-state-read-port";
import type { PersistedChatState } from "@/app/features/messaging/types";
import { normalizePublicKeyHex, normalizePublicKeyHexList } from "@/app/features/profile/utils/normalize-public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { useOptionalProfileMessageBus } from "@/app/features/profiles/providers/profile-runtime-provider";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { subscribeChatStateReplacedDual } from "@/app/features/profiles/services/subscribe-chat-state-replaced-dual";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { appendCanonicalContactEvent } from "@/app/features/account-sync/services/account-event-ingest-bridge";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { resolveProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import { selectProjectionAcceptedPeers } from "@/app/features/account-sync/services/account-projection-selectors";
import { resolvePeerTrustReadAuthority } from "@/app/features/network/services/peer-trust-read-authority";
import {
  canInheritUnscopedPeerTrust,
  getLegacyPeerTrustStorageKey,
  getPeerTrustStorageKey,
} from "@/app/features/network/services/peer-trust-storage-key";
import { logAppEvent } from "@/app/shared/log-app-event";

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
  /**
   * Local negative mask for peers removed/unaccepted.
   * Needed because account projection reads may lag behind optimistic removals,
   * causing "remove contact" to appear irreversible.
   */
  removedPeers: ReadonlyArray<PublicKeyHex>;
}>;

const createDefaultState = (): StoredPeerTrust => {
  return { acceptedPeers: [], mutedPeers: [], removedPeers: [] };
};

const createContactMutationIdempotencySuffix = (params: Readonly<{
  action: "accept" | "unaccept";
  peerPublicKeyHex: PublicKeyHex;
  atUnixMs: number;
  nonce: number;
}>): string => (
  `${params.action}:${params.peerPublicKeyHex}:${params.atUnixMs}:${params.nonce}`
);

const getStorageKey = (
  publicKeyHex: PublicKeyHex,
  profileId: string = getResolvedProfileId(),
): string => getPeerTrustStorageKey(publicKeyHex, profileId);

const DEBUG_PERSISTENCE_KEY = "obscur_debug_persistence";
const getDebugPersistenceKey = (): string => getScopedStorageKey(DEBUG_PERSISTENCE_KEY, getResolvedProfileId());

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
    removedPeers: value.removedPeers.filter((peer) => peer !== publicKeyHex),
  };
};

const parseStoredPeerTrust = (raw: string, publicKeyHex: PublicKeyHex): StoredPeerTrust | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const accepted = Array.isArray(record.acceptedPeers) ? (record.acceptedPeers as unknown[]) : [];
    const muted = Array.isArray(record.mutedPeers) ? (record.mutedPeers as unknown[]) : [];
    const removedRaw = Array.isArray(record.removedPeers) ? (record.removedPeers as unknown[]) : [];
    const acceptedPeers = normalizePublicKeyHexList(accepted.filter((v: unknown): v is string => typeof v === "string"));
    const mutedPeers = normalizePublicKeyHexList(muted.filter((v: unknown): v is string => typeof v === "string"));
    const removedPeers = normalizePublicKeyHexList(removedRaw.filter((v: unknown): v is string => typeof v === "string"));
    return removeSelfFromTrustState(publicKeyHex, { acceptedPeers, mutedPeers, removedPeers });
  } catch {
    return null;
  }
};

const loadFromStorage = (
  publicKeyHex: PublicKeyHex,
  profileId: string = getResolvedProfileId(),
): StoredPeerTrust => {
  if (typeof window === "undefined") {
    return createDefaultState();
  }
  try {
    const scopedKey = getStorageKey(publicKeyHex, profileId);
    const scopedRaw = window.localStorage.getItem(scopedKey);
    if (shouldDebugPersistence()) {
      console.info("[peerTrust] load", scopedKey, scopedRaw ? scopedRaw.length : 0);
    }
    if (scopedRaw) {
      return parseStoredPeerTrust(scopedRaw, publicKeyHex) ?? createDefaultState();
    }
    if (!canInheritUnscopedPeerTrust(profileId)) {
      return createDefaultState();
    }
    const legacyRaw = window.localStorage.getItem(getLegacyPeerTrustStorageKey(publicKeyHex));
    if (!legacyRaw) {
      return createDefaultState();
    }
    const inherited = parseStoredPeerTrust(legacyRaw, publicKeyHex);
    if (!inherited) {
      return createDefaultState();
    }
    saveToStorage(publicKeyHex, inherited, profileId);
    return inherited;
  } catch {
    return createDefaultState();
  }
};

type StoredPeerTrustWrite = Readonly<{
  acceptedPeers: ReadonlyArray<PublicKeyHex>;
  mutedPeers: ReadonlyArray<PublicKeyHex>;
  removedPeers?: ReadonlyArray<PublicKeyHex>;
}>;

const normalizeStoredPeerTrust = (value: StoredPeerTrustWrite): StoredPeerTrust => ({
  acceptedPeers: value.acceptedPeers,
  mutedPeers: value.mutedPeers,
  removedPeers: value.removedPeers ?? [],
});

const saveToStorage = (
  publicKeyHex: PublicKeyHex,
  value: StoredPeerTrustWrite,
  profileId: string = getResolvedProfileId(),
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const scopedKey = getStorageKey(publicKeyHex, profileId);
    const serialized = JSON.stringify(normalizeStoredPeerTrust(value));
    window.localStorage.setItem(scopedKey, serialized);
    if (shouldDebugPersistence()) {
      console.info("[peerTrust] save", scopedKey, serialized.length);
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

  // Trust is derived exclusively from explicit accept events, not from address-book presence.
  // createdConnections entries are NOT a trust signal — a connection can exist without a
  // completed two-way handshake (e.g. sender side before receiver accepts).
  const acceptedFromRequests: ReadonlyArray<PublicKeyHex> = (persisted.connectionRequests ?? [])
    .filter((request) => request.status === "accepted")
    .map((request) => normalizePublicKeyHex(request.id))
    .filter((peer): peer is PublicKeyHex => peer !== null);

  return Array.from(new Set(acceptedFromRequests));
};

export const usePeerTrust = (params: UsePeerTrustParams): UsePeerTrustResult => {
  const projectionSnapshot = useAccountProjectionSnapshot();
  const optionalProfileBus = useOptionalProfileMessageBus();
  const activeProfileId = getResolvedProfileId();
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

  const publicKeyHexRef = useRef<PublicKeyHex | null>(params.publicKeyHex);
  const profileIdRef = useRef(activeProfileId);
  useEffect(() => {
    publicKeyHexRef.current = params.publicKeyHex;
  }, [params.publicKeyHex]);
  useEffect(() => {
    profileIdRef.current = activeProfileId;
  }, [activeProfileId]);

  const [stored, setStored] = useState<StoredPeerTrust>(() => {
    if (!params.publicKeyHex) {
      return createDefaultState();
    }
    return loadFromStorage(params.publicKeyHex, activeProfileId);
  });
  const didLoadRef = useRef(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const peerTrustReadAuthorityLogKeyRef = useRef<string | null>(null);
  const peerTrustReadAuthority = useMemo(() => (
    resolvePeerTrustReadAuthority({
      shouldUseProjectionReads,
      projectionReadAuthorityReason: projectionReadAuthority.reason,
      projectionAcceptedPeers,
      storedAcceptedPeers: stored.acceptedPeers,
    })
  ), [
    projectionAcceptedPeers,
    projectionReadAuthority.reason,
    shouldUseProjectionReads,
    stored.acceptedPeers,
  ]);
  const contactMutationNonceRef = useRef(0);
  const hydrateAcceptedPeersFromChatState = useCallback((): void => {
    const currentPublicKeyHex = publicKeyHexRef.current;
    if (!currentPublicKeyHex) {
      return;
    }
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      const acceptedFromChat: ReadonlyArray<PublicKeyHex> = extractAcceptedPeersFromPersistedChatState(
        messagingChatStateReadPort.load(currentPublicKeyHex),
      );
      if (acceptedFromChat.length === 0) {
        return prev;
      }
      const merged = Array.from(new Set([...prev.acceptedPeers, ...acceptedFromChat]));
      if (
        merged.length === prev.acceptedPeers.length
        && merged.every((peer) => prev.acceptedPeers.includes(peer))
      ) {
        return prev;
      }
      const next: StoredPeerTrust = removeSelfFromTrustState(
        currentPublicKeyHex,
        { acceptedPeers: merged, mutedPeers: prev.mutedPeers, removedPeers: prev.removedPeers }
      );
      saveToStorage(currentPublicKeyHex, next, profileIdRef.current);
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
    didLoadRef.current = false;
    setHasHydrated(false);
    queueMicrotask((): void => {
      if (!params.publicKeyHex) {
        return;
      }
      const loaded = loadFromStorage(params.publicKeyHex, activeProfileId);
      setStored(loaded);
      setHasHydrated(true);
    });
  }, [activeProfileId, params.publicKeyHex]);

  useEffect((): void => {
    if (!params.publicKeyHex) {
      return;
    }
    queueMicrotask(() => {
      hydrateAcceptedPeersFromChatState();
    });
  }, [activeProfileId, hydrateAcceptedPeersFromChatState, params.publicKeyHex]);

  useEffect(() => {
    if (typeof window === "undefined" || !params.publicKeyHex) {
      return;
    }
    return subscribeChatStateReplacedDual((detail) => {
      const restoredPublicKeyHex = normalizePublicKeyHex(detail?.publicKeyHex);
      if (restoredPublicKeyHex && restoredPublicKeyHex !== params.publicKeyHex) {
        return;
      }
      if (detail?.profileId && detail.profileId !== getResolvedProfileId()) {
        return;
      }
      hydrateAcceptedPeersFromChatState();
    }, optionalProfileBus);
  }, [hydrateAcceptedPeersFromChatState, optionalProfileBus, params.publicKeyHex]);

  useEffect((): void => {
    if (!params.publicKeyHex || !hasHydrated) {
      return;
    }

    // Skip the very first render after hydration to avoid saving the same thing we just loaded
    if (!didLoadRef.current) {
      didLoadRef.current = true;
      return;
    }

    saveToStorage(params.publicKeyHex, stored, activeProfileId);
  }, [activeProfileId, hasHydrated, params.publicKeyHex, stored]);

  useEffect(() => {
    if (!params.publicKeyHex || !hasHydrated) {
      peerTrustReadAuthorityLogKeyRef.current = null;
      return;
    }
    const diagnosticKey = [
      params.publicKeyHex,
      peerTrustReadAuthority.source,
      peerTrustReadAuthority.holdReason ?? "",
      peerTrustReadAuthority.projectionReadAuthorityReason,
      peerTrustReadAuthority.acceptedPeers.length,
      stored.acceptedPeers.length,
      projectionAcceptedPeers.length,
    ].join("::");
    if (peerTrustReadAuthorityLogKeyRef.current === diagnosticKey) {
      return;
    }
    peerTrustReadAuthorityLogKeyRef.current = diagnosticKey;
    logAppEvent({
      name: "network.peer_trust_read_authority_selected",
      level: peerTrustReadAuthority.source === "legacy_hold" ? "warn" : "info",
      scope: { feature: "network", action: "peer_trust_read_authority" },
      context: {
        publicKeySuffix: params.publicKeyHex.slice(-8),
        selectedSource: peerTrustReadAuthority.source,
        holdReason: peerTrustReadAuthority.holdReason,
        projectionReadAuthorityReason: peerTrustReadAuthority.projectionReadAuthorityReason,
        acceptedPeerCount: peerTrustReadAuthority.acceptedPeers.length,
        storedPeerCount: stored.acceptedPeers.length,
        projectionPeerCount: projectionAcceptedPeers.length,
      },
    });
  }, [
    hasHydrated,
    params.publicKeyHex,
    peerTrustReadAuthority.acceptedPeers.length,
    peerTrustReadAuthority.holdReason,
    peerTrustReadAuthority.projectionReadAuthorityReason,
    peerTrustReadAuthority.source,
    projectionAcceptedPeers.length,
    stored.acceptedPeers.length,
  ]);

  const acceptedPeersForRead = useMemo(() => (
    peerTrustReadAuthority.acceptedPeers.filter((peer) => !stored.removedPeers.includes(peer))
  ), [peerTrustReadAuthority.acceptedPeers, stored.removedPeers]);

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
        saveToStorage(pk, next, profileIdRef.current);
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
        saveToStorage(pk, next, profileIdRef.current);
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
      const nextMuted: ReadonlyArray<PublicKeyHex> = prev.mutedPeers.filter((v: PublicKeyHex): boolean => v !== normalized);
      if (prev.acceptedPeers.includes(normalized) && nextMuted.length === prev.mutedPeers.length) {
        return prev;
      }
      const nextAccepted: ReadonlyArray<PublicKeyHex> = prev.acceptedPeers.includes(normalized)
        ? prev.acceptedPeers
        : [...prev.acceptedPeers, normalized];
      const nextRemoved: ReadonlyArray<PublicKeyHex> = prev.removedPeers.filter((v: PublicKeyHex): boolean => v !== normalized);
      const next: StoredPeerTrust = { acceptedPeers: nextAccepted, mutedPeers: nextMuted, removedPeers: nextRemoved };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next, profileIdRef.current);
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
  }, [nextContactMutationSuffix]);
  const unacceptPeer = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    const normalized = normalizePublicKeyHex(p.publicKeyHex);
    if (!normalized) return;
    setStored((prev: StoredPeerTrust): StoredPeerTrust => {
      if (!prev.acceptedPeers.includes(normalized)) {
        return prev;
      }
      const nextAcceptedPeers: ReadonlyArray<PublicKeyHex> = prev.acceptedPeers.filter((v: PublicKeyHex): boolean => v !== normalized);
      const nextRemovedPeers: ReadonlyArray<PublicKeyHex> = prev.removedPeers.includes(normalized)
        ? prev.removedPeers
        : [...prev.removedPeers, normalized];
      const next: StoredPeerTrust = { ...prev, acceptedPeers: nextAcceptedPeers, removedPeers: nextRemovedPeers };
      const pk = publicKeyHexRef.current;
      if (pk) {
        saveToStorage(pk, next, profileIdRef.current);
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
  }, [nextContactMutationSuffix]);
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
