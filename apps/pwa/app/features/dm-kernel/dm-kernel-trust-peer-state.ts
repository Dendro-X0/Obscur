import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import {
  countTimestampsInWindow,
  INVITE_FANOUT_WINDOW_MS,
} from "./dm-kernel-trust-spam-signals";

const STORAGE_ROOT = "obscur.dm_kernel_trust_peer_state.v1";

type PeerTrustState = Readonly<{
  connectionRequestTimestampsUnixMs: ReadonlyArray<number>;
}>;

const DEFAULT_PEER_STATE: PeerTrustState = {
  connectionRequestTimestampsUnixMs: [],
};

type StoredPeerStateByPubkey = Readonly<Record<string, PeerTrustState>>;

const readStore = (profileId: string): StoredPeerStateByPubkey => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(STORAGE_ROOT, profileId));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as StoredPeerStateByPubkey;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (profileId: string, store: StoredPeerStateByPubkey): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getScopedStorageKey(STORAGE_ROOT, profileId), JSON.stringify(store));
  } catch {
    // Best-effort local recipient state only.
  }
};

const normalizePeerKey = (peerPublicKeyHex: string): string => peerPublicKeyHex.trim().toLowerCase();

const prunePeerState = (state: PeerTrustState, nowUnixMs: number): PeerTrustState => ({
  connectionRequestTimestampsUnixMs: state.connectionRequestTimestampsUnixMs.filter(
    (value) => nowUnixMs - value <= INVITE_FANOUT_WINDOW_MS,
  ),
});

export const getDmTrustPeerState = (
  profileId: string,
  peerPublicKeyHex: string,
  nowUnixMs: number = Date.now(),
): PeerTrustState => {
  const store = readStore(profileId);
  const current = store[normalizePeerKey(peerPublicKeyHex)] ?? DEFAULT_PEER_STATE;
  return prunePeerState(current, nowUnixMs);
};

export const recordPeerConnectionRequest = (
  profileId: string,
  peerPublicKeyHex: string,
  timestampUnixMs: number,
): PeerTrustState => {
  const peerKey = normalizePeerKey(peerPublicKeyHex);
  const store = { ...readStore(profileId) };
  const current = prunePeerState(store[peerKey] ?? DEFAULT_PEER_STATE, timestampUnixMs);
  const next: PeerTrustState = {
    connectionRequestTimestampsUnixMs: [...current.connectionRequestTimestampsUnixMs, timestampUnixMs],
  };
  store[peerKey] = next;
  writeStore(profileId, store);
  return next;
};

export const getPeerConnectionRequestCountLastDay = (
  profileId: string,
  peerPublicKeyHex: string,
  nowUnixMs: number = Date.now(),
): number => {
  const state = getDmTrustPeerState(profileId, peerPublicKeyHex, nowUnixMs);
  return countTimestampsInWindow(
    state.connectionRequestTimestampsUnixMs,
    nowUnixMs,
    INVITE_FANOUT_WINDOW_MS,
  );
};
