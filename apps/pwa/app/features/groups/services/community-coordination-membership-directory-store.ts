import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { findJoinedLedgerEntryForCommunity } from "@/app/features/workspace-kernel/workspace-kernel-membership-scope";
import {
  fetchCoordinationMembershipDeltasSince,
  fetchCoordinationMembershipHead,
} from "./community-coordination-membership-client";
import {
  fetchCoordinationRoomKeyWrapsSince,
  materializeRoomKeysFromCoordinationWraps,
} from "./community-coordination-room-key-owner";
import {
  applyCoordinationMembershipDeltasToMaterialization,
  coordinationMembershipMaterializationsEqual,
  createEmptyCoordinationMembershipMaterialization,
  materializeCoordinationMembershipFromDeltas,
  type CoordinationMembershipMaterialization,
} from "./community-coordination-membership-materializer";
import { loadCommunityMembershipLedger } from "./community-membership-ledger";
import { isCoordinationConfigured } from "./community-membership-sync-mode";

const STORAGE_PREFIX = "obscur.community.coordination_membership_directory.v1";

/** Minimum spacing between incremental directory pulls (desktop online reliability). */
export const COORDINATION_DIRECTORY_MIN_REFRESH_MS = 8_000;

type DirectoryRefreshEntry = Readonly<{
  inFlight: Promise<CoordinationMembershipMaterialization | null> | null;
  lastCompletedAtMs: number;
}>;

const directoryRefreshByKey = new Map<string, DirectoryRefreshEntry>();

const directoryRefreshKey = (communityId: string, profileId: string): string => (
  `${profileId}:${communityId}`
);

export const COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT = "obscur:coordination-membership-directory-changed";

export type CoordinationDirectoryRoomKeyMaterializationContext = Readonly<{
  localPubkey: PublicKeyHex;
  localPrivateKeyHex: PrivateKeyHex;
  groupId?: string;
}>;

type StoredDirectoryRecord = Readonly<{
  communityId: string;
  materialization: CoordinationMembershipMaterialization;
  updatedAtUnixMs: number;
}>;

const toProfileStorageKey = (profileId?: string): string => (
  getScopedStorageKey(STORAGE_PREFIX, profileId ?? getResolvedProfileId())
);

const loadAllDirectoryRecords = (profileId?: string): ReadonlyArray<StoredDirectoryRecord> => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(toProfileStorageKey(profileId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is StoredDirectoryRecord => (
      !!entry
      && typeof entry === "object"
      && typeof (entry as StoredDirectoryRecord).communityId === "string"
      && !!(entry as StoredDirectoryRecord).materialization
    ));
  } catch {
    return [];
  }
};

const saveAllDirectoryRecords = (
  records: ReadonlyArray<StoredDirectoryRecord>,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(toProfileStorageKey(profileId), JSON.stringify(records));
};

const notifyDirectoryChanged = (communityId: string, profileId?: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, {
    detail: { communityId, profileId: profileId ?? getResolvedProfileId() },
  }));
};

export const loadCoordinationMembershipDirectory = (
  communityId: string,
  profileId?: string,
): CoordinationMembershipMaterialization | null => {
  const normalizedCommunityId = communityId.trim();
  if (!normalizedCommunityId) {
    return null;
  }
  const record = loadAllDirectoryRecords(profileId).find((entry) => (
    entry.communityId === normalizedCommunityId
  ));
  return record?.materialization ?? null;
};

export const listCoordinationMembershipDirectoryRecords = (
  profileId?: string,
): ReadonlyArray<StoredDirectoryRecord> => loadAllDirectoryRecords(profileId);

export const saveCoordinationMembershipDirectory = (params: Readonly<{
  communityId: string;
  materialization: CoordinationMembershipMaterialization;
  profileId?: string;
}>): void => {
  const normalizedCommunityId = params.communityId.trim();
  if (!normalizedCommunityId) {
    return;
  }
  const existingMaterialization = loadCoordinationMembershipDirectory(
    normalizedCommunityId,
    params.profileId,
  );
  if (
    existingMaterialization
    && coordinationMembershipMaterializationsEqual(existingMaterialization, params.materialization)
  ) {
    return;
  }
  const existing = loadAllDirectoryRecords(params.profileId).filter((entry) => (
    entry.communityId !== normalizedCommunityId
  ));
  saveAllDirectoryRecords([
    ...existing,
    {
      communityId: normalizedCommunityId,
      materialization: params.materialization,
      updatedAtUnixMs: Date.now(),
    },
  ], params.profileId);
  notifyDirectoryChanged(normalizedCommunityId, params.profileId);
};

const resolveGroupIdForRoomKeyMaterialization = (params: Readonly<{
  communityId: string;
  profileId?: string;
  roomKeyMaterialization: CoordinationDirectoryRoomKeyMaterializationContext;
}>): string | null => {
  const explicitGroupId = params.roomKeyMaterialization.groupId?.trim();
  if (explicitGroupId) {
    return explicitGroupId;
  }
  const ledger = loadCommunityMembershipLedger(params.roomKeyMaterialization.localPubkey, {
    profileId: params.profileId,
  });
  const entry = findJoinedLedgerEntryForCommunity(ledger, params.communityId);
  return entry?.groupId?.trim() || null;
};

/** C3 — fetch coordination wraps and materialize local room key after directory save. */
export const materializeCoordinationRoomKeysAfterDirectoryRefresh = async (params: Readonly<{
  communityId: string;
  materialization: CoordinationMembershipMaterialization;
  profileId?: string;
  roomKeyMaterialization?: CoordinationDirectoryRoomKeyMaterializationContext;
}>): Promise<Readonly<{ materialized: boolean; roomKeyHex: string | null; error?: string }>> => {
  const communityId = params.communityId.trim();
  if (!communityId || !params.roomKeyMaterialization) {
    return { materialized: false, roomKeyHex: null, error: "materialization_context_missing" };
  }

  const groupId = resolveGroupIdForRoomKeyMaterialization({
    communityId,
    profileId: params.profileId,
    roomKeyMaterialization: params.roomKeyMaterialization,
  });
  if (!groupId) {
    return { materialized: false, roomKeyHex: null, error: "group_id_unresolved" };
  }

  const fetched = await fetchCoordinationRoomKeyWrapsSince(communityId, 0);
  if (!fetched.ok) {
    return { materialized: false, roomKeyHex: null, error: fetched.error };
  }

  return materializeRoomKeysFromCoordinationWraps({
    groupId,
    communityId,
    localPubkey: params.roomKeyMaterialization.localPubkey,
    localPrivateKeyHex: params.roomKeyMaterialization.localPrivateKeyHex,
    wraps: fetched.wraps,
    activeMemberPubkeys: params.materialization.activeMemberPubkeys,
  });
};

const persistDirectoryMaterialization = async (params: Readonly<{
  communityId: string;
  materialization: CoordinationMembershipMaterialization;
  profileId?: string;
  roomKeyMaterialization?: CoordinationDirectoryRoomKeyMaterializationContext;
}>): Promise<CoordinationMembershipMaterialization> => {
  const existingMaterialization = loadCoordinationMembershipDirectory(
    params.communityId,
    params.profileId,
  );
  const materializationChanged = !existingMaterialization
    || !coordinationMembershipMaterializationsEqual(existingMaterialization, params.materialization);

  saveCoordinationMembershipDirectory({
    communityId: params.communityId,
    materialization: params.materialization,
    profileId: params.profileId,
  });

  if (materializationChanged && params.roomKeyMaterialization) {
    await materializeCoordinationRoomKeysAfterDirectoryRefresh({
      communityId: params.communityId,
      materialization: params.materialization,
      profileId: params.profileId,
      roomKeyMaterialization: params.roomKeyMaterialization,
    });
  }

  return params.materialization;
};

export const resetCoordinationMembershipDirectoryForTests = (): void => {
  directoryRefreshByKey.clear();
  if (typeof window === "undefined") {
    return;
  }
  Object.keys(window.localStorage)
    .filter((key) => key.includes(STORAGE_PREFIX))
    .forEach((key) => window.localStorage.removeItem(key));
};

const fetchAllCoordinationMembershipDeltas = async (
  communityId: string,
): Promise<ReadonlyArray<import("./community-coordination-membership-client").CoordinationMembershipDeltaRecord>> => {
  let sinceSeq = 0;
  const allDeltas: import("./community-coordination-membership-client").CoordinationMembershipDeltaRecord[] = [];
  for (let page = 0; page < 64; page += 1) {
    const result = await fetchCoordinationMembershipDeltasSince(communityId, sinceSeq);
    if (!result.ok || result.deltas.length === 0) {
      break;
    }
    allDeltas.push(...result.deltas);
    sinceSeq = Math.max(...result.deltas.map((delta) => delta.seq));
    if (result.deltas.length < 200) {
      break;
    }
  }
  return allDeltas;
};

const refreshCoordinationMembershipDirectoryInner = async (params: Readonly<{
  communityId: string;
  profileId?: string;
  forceFull?: boolean;
  roomKeyMaterialization?: CoordinationDirectoryRoomKeyMaterializationContext;
}>): Promise<CoordinationMembershipMaterialization | null> => {
  const communityId = params.communityId.trim();
  if (!communityId || !isCoordinationConfigured()) {
    return null;
  }

  if (params.forceFull) {
    const allDeltas = await fetchAllCoordinationMembershipDeltas(communityId);
    const materialization = materializeCoordinationMembershipFromDeltas(allDeltas);
    return persistDirectoryMaterialization({
      communityId,
      materialization,
      profileId: params.profileId,
      roomKeyMaterialization: params.roomKeyMaterialization,
    });
  }

  const current = loadCoordinationMembershipDirectory(communityId, params.profileId)
    ?? createEmptyCoordinationMembershipMaterialization();
  const result = await fetchCoordinationMembershipDeltasSince(communityId, current.headSeq);
  if (!result.ok) {
    return current.headSeq > 0 ? current : null;
  }
  if (result.deltas.length === 0) {
    const head = await fetchCoordinationMembershipHead(communityId);
    if (head && current.headSeq > head.seq) {
      const allDeltas = await fetchAllCoordinationMembershipDeltas(communityId);
      const materialization = materializeCoordinationMembershipFromDeltas(allDeltas);
      return persistDirectoryMaterialization({
        communityId,
        materialization,
        profileId: params.profileId,
        roomKeyMaterialization: params.roomKeyMaterialization,
      });
    }
    return current;
  }
  const materialization = applyCoordinationMembershipDeltasToMaterialization(current, result.deltas);
  return persistDirectoryMaterialization({
    communityId,
    materialization,
    profileId: params.profileId,
    roomKeyMaterialization: params.roomKeyMaterialization,
  });
};

/** Rebuild coordination directory from seq 0 and persist (authoritative invite gate input). */
export const refreshCoordinationMembershipDirectory = async (params: Readonly<{
  communityId: string;
  profileId?: string;
  forceFull?: boolean;
  roomKeyMaterialization?: CoordinationDirectoryRoomKeyMaterializationContext;
}>): Promise<CoordinationMembershipMaterialization | null> => {
  const communityId = params.communityId.trim();
  if (!communityId || !isCoordinationConfigured()) {
    return null;
  }
  const profileId = params.profileId ?? getResolvedProfileId();
  const key = directoryRefreshKey(communityId, profileId);
  const forceFull = params.forceFull === true;
  const entry = directoryRefreshByKey.get(key) ?? { inFlight: null, lastCompletedAtMs: 0 };

  if (entry.inFlight) {
    return entry.inFlight;
  }

  if (!forceFull) {
    const cached = loadCoordinationMembershipDirectory(communityId, profileId);
    const elapsedMs = Date.now() - entry.lastCompletedAtMs;
    if (cached && cached.headSeq > 0 && elapsedMs < COORDINATION_DIRECTORY_MIN_REFRESH_MS) {
      return cached;
    }
  }

  const inFlight = refreshCoordinationMembershipDirectoryInner({
    ...params,
    communityId,
    profileId,
  }).finally(() => {
    directoryRefreshByKey.set(key, {
      inFlight: null,
      lastCompletedAtMs: Date.now(),
    });
  });

  directoryRefreshByKey.set(key, {
    inFlight,
    lastCompletedAtMs: entry.lastCompletedAtMs,
  });
  return inFlight;
};

export const applyCoordinationMembershipDeltasToDirectoryStore = (params: Readonly<{
  communityId: string;
  deltas: ReadonlyArray<import("./community-coordination-membership-client").CoordinationMembershipDeltaRecord>;
  profileId?: string;
  roomKeyMaterialization?: CoordinationDirectoryRoomKeyMaterializationContext;
}>): CoordinationMembershipMaterialization | null => {
  const communityId = params.communityId.trim();
  if (!communityId || params.deltas.length === 0) {
    return loadCoordinationMembershipDirectory(communityId, params.profileId);
  }
  const current = loadCoordinationMembershipDirectory(communityId, params.profileId)
    ?? createEmptyCoordinationMembershipMaterialization();
  const materialization = applyCoordinationMembershipDeltasToMaterialization(current, params.deltas);
  saveCoordinationMembershipDirectory({
    communityId,
    materialization,
    profileId: params.profileId,
  });
  if (params.roomKeyMaterialization) {
    void materializeCoordinationRoomKeysAfterDirectoryRefresh({
      communityId,
      materialization,
      profileId: params.profileId,
      roomKeyMaterialization: params.roomKeyMaterialization,
    });
  }
  return materialization;
};
