"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { validateRelayUrl } from "@/app/features/relays/utils/validate-relay-url";

type PeerRelayEvidence = Readonly<{
  relayUrls: ReadonlyArray<string>;
  lastObservedAtUnixMs: number;
}>;

type PeerRelayEvidenceState = Readonly<{
  byPeer: Readonly<Record<string, PeerRelayEvidence>>;
}>;

const STORAGE_KEY = "obscur.messaging.peer_relay_evidence.v1";
const MAX_PEER_ENTRIES = 256;
const MAX_RELAY_URLS_PER_PEER = 8;
const RELAY_EVIDENCE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const getStorageKey = (): string => getScopedStorageKey(STORAGE_KEY);

const createEmptyState = (): PeerRelayEvidenceState => ({
  byPeer: {},
});

const toTrustedRelayUrl = (candidate: string): string | null => {
  const validated = validateRelayUrl(candidate);
  return validated?.normalizedUrl ?? null;
};

const normalizePeer = (peerPublicKeyHex: string): PublicKeyHex | null => normalizePublicKeyHex(peerPublicKeyHex);

const sanitizeRelayUrls = (relayUrls: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(
    new Set(
      relayUrls
        .map((relayUrl) => toTrustedRelayUrl(relayUrl))
        .filter((relayUrl): relayUrl is string => Boolean(relayUrl))
    )
  ).slice(0, MAX_RELAY_URLS_PER_PEER)
);

const sanitizeState = (
  state: PeerRelayEvidenceState,
  nowUnixMs: number = Date.now()
): PeerRelayEvidenceState => {
  const nextEntries = Object.entries(state.byPeer)
    .map(([peer, evidence]) => {
      const normalizedPeer = normalizePeer(peer);
      if (!normalizedPeer) {
        return null;
      }
      const relayUrls = sanitizeRelayUrls(evidence.relayUrls);
      if (relayUrls.length === 0) {
        return null;
      }
      if ((nowUnixMs - evidence.lastObservedAtUnixMs) > RELAY_EVIDENCE_TTL_MS) {
        return null;
      }
      return [normalizedPeer, {
        relayUrls,
        lastObservedAtUnixMs: evidence.lastObservedAtUnixMs,
      }] as const;
    })
    .filter((entry): entry is readonly [string, PeerRelayEvidence] => Boolean(entry))
    .sort((a, b) => b[1].lastObservedAtUnixMs - a[1].lastObservedAtUnixMs)
    .slice(0, MAX_PEER_ENTRIES);

  return {
    byPeer: Object.fromEntries(nextEntries),
  };
};

const readState = (): PeerRelayEvidenceState => {
  if (typeof window === "undefined") {
    return createEmptyState();
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey());
    if (!raw) {
      return createEmptyState();
    }
    const parsed = JSON.parse(raw) as PeerRelayEvidenceState;
    if (!parsed || typeof parsed !== "object" || typeof parsed.byPeer !== "object") {
      return createEmptyState();
    }
    return sanitizeState(parsed);
  } catch {
    return createEmptyState();
  }
};

const writeState = (state: PeerRelayEvidenceState): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getStorageKey(), JSON.stringify(sanitizeState(state)));
  } catch {
    // Keep transport path non-throwing when storage is unavailable.
  }
};

const recordInboundRelay = (params: Readonly<{
  peerPublicKeyHex: string;
  relayUrl: string;
  observedAtUnixMs?: number;
}>): ReadonlyArray<string> => {
  const normalizedPeer = normalizePeer(params.peerPublicKeyHex);
  const trustedRelayUrl = toTrustedRelayUrl(params.relayUrl);
  if (!normalizedPeer || !trustedRelayUrl) {
    return [];
  }

  const nowUnixMs = params.observedAtUnixMs ?? Date.now();
  const state = readState();
  const current = state.byPeer[normalizedPeer];
  const relayUrls = sanitizeRelayUrls([
    trustedRelayUrl,
    ...(current?.relayUrls ?? []),
  ]);
  writeState({
    byPeer: {
      ...state.byPeer,
      [normalizedPeer]: {
        relayUrls,
        lastObservedAtUnixMs: nowUnixMs,
      },
    },
  });
  return relayUrls;
};

const getRelayUrls = (peerPublicKeyHex: string): ReadonlyArray<string> => {
  const normalizedPeer = normalizePeer(peerPublicKeyHex);
  if (!normalizedPeer) {
    return [];
  }
  const state = readState();
  return state.byPeer[normalizedPeer]?.relayUrls ?? [];
};

const clearPeer = (peerPublicKeyHex: string): void => {
  const normalizedPeer = normalizePeer(peerPublicKeyHex);
  if (!normalizedPeer) {
    return;
  }
  const state = readState();
  const { [normalizedPeer]: _unused, ...rest } = state.byPeer;
  void _unused;
  writeState({ byPeer: rest });
};

const clear = (): void => {
  writeState(createEmptyState());
};

export const peerRelayEvidenceStore = {
  recordInboundRelay,
  getRelayUrls,
  clearPeer,
  clear,
};

export const peerRelayEvidenceStoreInternals = {
  STORAGE_KEY,
  MAX_PEER_ENTRIES,
  MAX_RELAY_URLS_PER_PEER,
  RELAY_EVIDENCE_TTL_MS,
  getStorageKey,
  readState,
  writeState,
  sanitizeState,
};
