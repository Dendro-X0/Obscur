/**
 * Cut 1.1 — sticky CRM authority is SQLite relationship_edge via privateTrust.
 * peer-trust localStorage is non-authoritative on native (browser stays degraded LS).
 */

import { isTauri } from "@dweb/db";
import { createTauriEngineHost } from "@obscur/engine-host/tauri";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  listRelationshipEdges,
  upsertRelationshipEdge,
  type RelationshipEdgeRecord,
} from "@obscur/private-trust-engine";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

export const RELATIONSHIP_EDGE_STATES = {
  none: "none",
  pending: "pending",
  trusted: "trusted",
  blocked: "blocked",
  muted: "muted",
  removed: "removed",
} as const;

export type StickyPeerTrustSnapshot = Readonly<{
  acceptedPeers: ReadonlyArray<PublicKeyHex>;
  mutedPeers: ReadonlyArray<PublicKeyHex>;
  removedPeers: ReadonlyArray<PublicKeyHex>;
}>;

export type RelationshipEdgePlanRow = Readonly<{
  peerPubkey: string;
  state: string;
  trustTier: string | null;
}>;

export const usesKernelRelationshipAuthority = (): boolean =>
  requiresSqlitePersistence() && isTauri();

let privateTrustEngineHost: HostEnginePort | null = null;

const getPrivateTrustEngineHost = (): HostEnginePort => {
  privateTrustEngineHost ??= createTauriEngineHost();
  return privateTrustEngineHost;
};

/** Test seam — inject host without Tauri. */
export const setPrivateTrustEngineHostForTests = (host: HostEnginePort | null): void => {
  privateTrustEngineHost = host;
};

export const isEmptyStickyPeerTrust = (value: StickyPeerTrustSnapshot): boolean => (
  value.acceptedPeers.length === 0
  && value.mutedPeers.length === 0
  && value.removedPeers.length === 0
);

/**
 * Map UI sticky snapshot → relationship_edge upsert plan.
 * accepted+muted → trusted + trust_tier=muted (mute orthogonal in UI; one state column in SQLite).
 */
export const planRelationshipEdgesFromStickyTrust = (
  stored: StickyPeerTrustSnapshot,
): ReadonlyArray<RelationshipEdgePlanRow> => {
  const removed = new Set(stored.removedPeers.map((p) => p.toLowerCase()));
  const muted = new Set(stored.mutedPeers.map((p) => p.toLowerCase()));
  const rows = new Map<string, RelationshipEdgePlanRow>();

  for (const peer of stored.removedPeers) {
    const key = peer.toLowerCase();
    rows.set(key, { peerPubkey: key, state: RELATIONSHIP_EDGE_STATES.removed, trustTier: null });
  }

  for (const peer of stored.acceptedPeers) {
    const key = peer.toLowerCase();
    if (removed.has(key)) {
      continue;
    }
    rows.set(key, {
      peerPubkey: key,
      state: RELATIONSHIP_EDGE_STATES.trusted,
      trustTier: muted.has(key) ? "muted" : null,
    });
  }

  for (const peer of stored.mutedPeers) {
    const key = peer.toLowerCase();
    if (removed.has(key) || rows.has(key)) {
      continue;
    }
    rows.set(key, { peerPubkey: key, state: RELATIONSHIP_EDGE_STATES.muted, trustTier: null });
  }

  return Array.from(rows.values());
};

export const mapRelationshipEdgesToStickyTrust = (
  edges: ReadonlyArray<RelationshipEdgeRecord>,
  selfPublicKeyHex: PublicKeyHex | null,
): StickyPeerTrustSnapshot => {
  const accepted: PublicKeyHex[] = [];
  const muted: PublicKeyHex[] = [];
  const removed: PublicKeyHex[] = [];
  const self = selfPublicKeyHex ? selfPublicKeyHex.toLowerCase() : null;

  for (const edge of edges) {
    const peer = normalizePublicKeyHex(edge.peer_pubkey);
    if (!peer || (self && peer === self)) {
      continue;
    }
    const state = edge.state.trim().toLowerCase();
    if (state === RELATIONSHIP_EDGE_STATES.removed) {
      removed.push(peer);
      continue;
    }
    if (state === RELATIONSHIP_EDGE_STATES.trusted) {
      accepted.push(peer);
      if ((edge.trust_tier ?? "").trim().toLowerCase() === "muted") {
        muted.push(peer);
      }
      continue;
    }
    if (state === RELATIONSHIP_EDGE_STATES.muted) {
      muted.push(peer);
    }
  }

  return {
    acceptedPeers: Array.from(new Set(accepted)),
    mutedPeers: Array.from(new Set(muted)),
    removedPeers: Array.from(new Set(removed)),
  };
};

export const persistStickyTrustToKernel = async (
  profileId: string,
  stored: StickyPeerTrustSnapshot,
): Promise<void> => {
  if (!usesKernelRelationshipAuthority() || !profileId.trim()) {
    return;
  }
  const host = getPrivateTrustEngineHost();
  const desired = planRelationshipEdgesFromStickyTrust(stored);
  const desiredKeys = new Set(desired.map((row) => row.peerPubkey));

  const existing = await listRelationshipEdges({ host, profileId: profileId.trim() });
  await Promise.all(
    desired.map((row) =>
      upsertRelationshipEdge({
        host,
        profileId: profileId.trim(),
        peerPubkey: row.peerPubkey,
        state: row.state,
        trustTier: row.trustTier,
      }),
    ),
  );

  // Clear sticky orphans that left the UI snapshot without an explicit row.
  await Promise.all(
    existing
      .filter((edge) => {
        const key = edge.peer_pubkey.trim().toLowerCase();
        if (!key || desiredKeys.has(key)) {
          return false;
        }
        const state = edge.state.trim().toLowerCase();
        return state === RELATIONSHIP_EDGE_STATES.trusted
          || state === RELATIONSHIP_EDGE_STATES.pending
          || state === RELATIONSHIP_EDGE_STATES.muted;
      })
      .map((edge) => {
        const state = edge.state.trim().toLowerCase();
        const nextState = state === RELATIONSHIP_EDGE_STATES.muted
          ? RELATIONSHIP_EDGE_STATES.none
          : RELATIONSHIP_EDGE_STATES.removed;
        return upsertRelationshipEdge({
          host,
          profileId: profileId.trim(),
          peerPubkey: edge.peer_pubkey,
          state: nextState,
          trustTier: null,
        });
      }),
  );
};

export const loadStickyTrustFromKernel = async (
  profileId: string,
  selfPublicKeyHex: PublicKeyHex | null,
): Promise<StickyPeerTrustSnapshot> => {
  if (!usesKernelRelationshipAuthority() || !profileId.trim()) {
    return { acceptedPeers: [], mutedPeers: [], removedPeers: [] };
  }
  const edges = await listRelationshipEdges({
    host: getPrivateTrustEngineHost(),
    profileId: profileId.trim(),
  });
  return mapRelationshipEdgesToStickyTrust(edges, selfPublicKeyHex);
};
