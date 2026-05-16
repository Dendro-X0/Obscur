import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getProfileRuntimeScope, getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

type PeerInteractionState = Readonly<{
  version: 1;
  lastActiveByPeerPubkey: Readonly<Record<string, number>>;
}>;

const STORAGE_PREFIX = "obscur.messaging.peer-interaction.v1";

/** Legacy window + bus event when peer last-active map changes */
export const PEER_INTERACTION_UPDATED_EVENT = "obscur:peer-interaction-updated" as const;

export type PeerInteractionUpdatedEventDetail = Readonly<{
  publicKeyHex: string;
  profileId?: string;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const getStorageKey = (publicKeyHex: PublicKeyHex, profileId?: string): string => (
  getScopedStorageKey(`${STORAGE_PREFIX}.${publicKeyHex}`, profileId ?? getResolvedProfileId())
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

const readState = (publicKeyHex: PublicKeyHex, profileId?: string): PeerInteractionState => {
  if (typeof window === "undefined") {
    return { version: 1, lastActiveByPeerPubkey: {} };
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(publicKeyHex, profileId));
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

const writeState = (publicKeyHex: PublicKeyHex, state: PeerInteractionState, scopeProfileId?: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getStorageKey(publicKeyHex, scopeProfileId), JSON.stringify(state));
    const resolvedProfileIdForBus = scopeProfileId ?? getResolvedProfileId();
    const detail: PeerInteractionUpdatedEventDetail = {
      publicKeyHex,
      profileId: resolvedProfileIdForBus,
    };
    const scope = getProfileRuntimeScope();
    if (scope?.bus && scope.profileId === resolvedProfileIdForBus) {
      scope.bus.publish({
        type: "peer-interaction-updated",
        detail,
      });
    }
  } catch {
    return;
  }
};

export const loadPeerLastActiveByPeerPubkey = (
  publicKeyHex: PublicKeyHex,
  profileId?: string,
): Readonly<Record<string, number>> => {
  return readState(publicKeyHex, profileId).lastActiveByPeerPubkey;
};

export const recordPeerLastActive = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  peerPublicKeyHex: PublicKeyHex;
  activeAtMs: number;
  profileId?: string;
}>): void => {
  if (!Number.isFinite(params.activeAtMs) || params.activeAtMs <= 0) {
    return;
  }
  const profileId = params.profileId;
  const current = readState(params.publicKeyHex, profileId);
  if ((current.lastActiveByPeerPubkey[params.peerPublicKeyHex] ?? 0) >= params.activeAtMs) {
    return;
  }
  writeState(params.publicKeyHex, {
    version: 1,
    lastActiveByPeerPubkey: {
      ...current.lastActiveByPeerPubkey,
      [params.peerPublicKeyHex]: params.activeAtMs,
    },
  }, profileId);
};

export const peerInteractionStoreInternals = {
  getStorageKey,
  storagePrefix: STORAGE_PREFIX,
  storageUpdateEvent: PEER_INTERACTION_UPDATED_EVENT,
};

