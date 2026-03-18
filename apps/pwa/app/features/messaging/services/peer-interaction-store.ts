import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

type PeerInteractionState = Readonly<{
  version: 1;
  lastActiveByPeerPubkey: Readonly<Record<string, number>>;
}>;

const STORAGE_PREFIX = "obscur.messaging.peer-interaction.v1";
const STORAGE_UPDATE_EVENT = "obscur:peer-interaction-updated";

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const getStorageKey = (publicKeyHex: PublicKeyHex): string => (
  getScopedStorageKey(`${STORAGE_PREFIX}.${publicKeyHex}`)
);

const normalizePeerActivityMap = (value: unknown): Readonly<Record<string, number>> => {
  if (!isRecord(value)) {
    return {};
  }
  const next: Record<string, number> = {};
  Object.entries(value).forEach(([peerPubkey, rawTimestamp]) => {
    if (typeof rawTimestamp !== "number" || !Number.isFinite(rawTimestamp) || rawTimestamp <= 0) {
      return;
    }
    if (typeof peerPubkey !== "string" || peerPubkey.trim().length === 0) {
      return;
    }
    next[peerPubkey] = rawTimestamp;
  });
  return next;
};

const readState = (publicKeyHex: PublicKeyHex): PeerInteractionState => {
  if (typeof window === "undefined") {
    return { version: 1, lastActiveByPeerPubkey: {} };
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(publicKeyHex));
    if (!raw) {
      return { version: 1, lastActiveByPeerPubkey: {} };
    }
    const parsed = JSON.parse(raw) as Partial<PeerInteractionState>;
    if (parsed.version !== 1) {
      return { version: 1, lastActiveByPeerPubkey: {} };
    }
    return {
      version: 1,
      lastActiveByPeerPubkey: normalizePeerActivityMap(parsed.lastActiveByPeerPubkey),
    };
  } catch {
    return { version: 1, lastActiveByPeerPubkey: {} };
  }
};

const writeState = (publicKeyHex: PublicKeyHex, state: PeerInteractionState): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getStorageKey(publicKeyHex), JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(STORAGE_UPDATE_EVENT, {
      detail: {
        publicKeyHex,
      },
    }));
  } catch {
    return;
  }
};

export const loadPeerLastActiveByPeerPubkey = (
  publicKeyHex: PublicKeyHex
): Readonly<Record<string, number>> => {
  return readState(publicKeyHex).lastActiveByPeerPubkey;
};

export const recordPeerLastActive = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  peerPublicKeyHex: PublicKeyHex;
  activeAtMs: number;
}>): void => {
  if (!Number.isFinite(params.activeAtMs) || params.activeAtMs <= 0) {
    return;
  }
  const current = readState(params.publicKeyHex);
  if ((current.lastActiveByPeerPubkey[params.peerPublicKeyHex] ?? 0) >= params.activeAtMs) {
    return;
  }
  writeState(params.publicKeyHex, {
    version: 1,
    lastActiveByPeerPubkey: {
      ...current.lastActiveByPeerPubkey,
      [params.peerPublicKeyHex]: params.activeAtMs,
    },
  });
};

export const peerInteractionStoreInternals = {
  getStorageKey,
  storagePrefix: STORAGE_PREFIX,
  storageUpdateEvent: STORAGE_UPDATE_EVENT,
};

