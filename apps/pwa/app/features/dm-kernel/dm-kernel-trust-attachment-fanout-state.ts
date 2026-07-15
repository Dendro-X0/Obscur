import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import {
  ATTACHMENT_REPEAT_HASH_WINDOW_MS,
  normalizeAttachmentFanoutDigest,
  normalizeAttachmentFanoutPeerKey,
} from "./dm-kernel-trust-metadata-signals";

const STORAGE_ROOT = "obscur.dm_kernel_trust_attachment_fanout.v1";

type FanoutPeerObservation = Readonly<{
  peerPublicKeyHex: string;
  lastSeenAtUnixMs: number;
}>;

type FanoutHashState = Readonly<{
  peers: ReadonlyArray<FanoutPeerObservation>;
}>;

type StoredFanoutByHash = Readonly<Record<string, FanoutHashState>>;

const readStore = (profileId: string): StoredFanoutByHash => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(STORAGE_ROOT, profileId));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as StoredFanoutByHash;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (profileId: string, store: StoredFanoutByHash): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getScopedStorageKey(STORAGE_ROOT, profileId), JSON.stringify(store));
  } catch {
    // Best-effort recipient-local fanout tracking only.
  }
};

const pruneFanoutState = (
  state: FanoutHashState,
  nowUnixMs: number,
  windowMs: number = ATTACHMENT_REPEAT_HASH_WINDOW_MS,
): FanoutHashState => ({
  peers: state.peers.filter((entry) => nowUnixMs - entry.lastSeenAtUnixMs <= windowMs),
});

const countDistinctPeers = (state: FanoutHashState): number => (
  new Set(state.peers.map((entry) => entry.peerPublicKeyHex)).size
);

export const getAttachmentRepeatHashDistinctPeerCount = (
  profileId: string,
  contentDigestHex: string,
  nowUnixMs: number = Date.now(),
): number => {
  const digestKey = normalizeAttachmentFanoutDigest(contentDigestHex);
  const store = readStore(profileId);
  const current = pruneFanoutState(store[digestKey] ?? { peers: [] }, nowUnixMs);
  return countDistinctPeers(current);
};

export const recordAttachmentContentDigestObservation = (
  profileId: string,
  contentDigestHex: string,
  peerPublicKeyHex: string,
  timestampUnixMs: number,
): number => {
  const digestKey = normalizeAttachmentFanoutDigest(contentDigestHex);
  const peerKey = normalizeAttachmentFanoutPeerKey(peerPublicKeyHex);
  const store = { ...readStore(profileId) };
  const pruned = pruneFanoutState(store[digestKey] ?? { peers: [] }, timestampUnixMs);
  const peers = [...pruned.peers];
  const existingIndex = peers.findIndex((entry) => entry.peerPublicKeyHex === peerKey);
  if (existingIndex >= 0) {
    peers[existingIndex] = { peerPublicKeyHex: peerKey, lastSeenAtUnixMs: timestampUnixMs };
  } else {
    peers.push({ peerPublicKeyHex: peerKey, lastSeenAtUnixMs: timestampUnixMs });
  }
  const next: FanoutHashState = { peers };
  store[digestKey] = next;
  writeStore(profileId, store);
  return countDistinctPeers(next);
};
