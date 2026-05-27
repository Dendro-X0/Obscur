import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  fetchCoordinationMembershipDeltasSince,
} from "./community-coordination-membership-client";
import {
  applyCoordinationMembershipDeltasToMaterialization,
  createEmptyCoordinationMembershipMaterialization,
  materializeCoordinationMembershipFromDeltas,
  type CoordinationMembershipMaterialization,
} from "./community-coordination-membership-materializer";
import { isCoordinationConfigured } from "./community-membership-sync-mode";

const STORAGE_PREFIX = "obscur.community.coordination_membership_directory.v1";

export const COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT = "obscur:coordination-membership-directory-changed";

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

export const saveCoordinationMembershipDirectory = (params: Readonly<{
  communityId: string;
  materialization: CoordinationMembershipMaterialization;
  profileId?: string;
}>): void => {
  const normalizedCommunityId = params.communityId.trim();
  if (!normalizedCommunityId) {
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

export const resetCoordinationMembershipDirectoryForTests = (): void => {
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

/** Rebuild coordination directory from seq 0 and persist (authoritative invite gate input). */
export const refreshCoordinationMembershipDirectory = async (params: Readonly<{
  communityId: string;
  profileId?: string;
  forceFull?: boolean;
}>): Promise<CoordinationMembershipMaterialization | null> => {
  const communityId = params.communityId.trim();
  if (!communityId || !isCoordinationConfigured()) {
    return null;
  }

  if (params.forceFull) {
    const allDeltas = await fetchAllCoordinationMembershipDeltas(communityId);
    const materialization = materializeCoordinationMembershipFromDeltas(allDeltas);
    saveCoordinationMembershipDirectory({
      communityId,
      materialization,
      profileId: params.profileId,
    });
    return materialization;
  }

  const current = loadCoordinationMembershipDirectory(communityId, params.profileId)
    ?? createEmptyCoordinationMembershipMaterialization();
  const result = await fetchCoordinationMembershipDeltasSince(communityId, current.headSeq);
  if (!result.ok) {
    return current.headSeq > 0 ? current : null;
  }
  if (result.deltas.length === 0) {
    return current;
  }
  const materialization = applyCoordinationMembershipDeltasToMaterialization(current, result.deltas);
  saveCoordinationMembershipDirectory({
    communityId,
    materialization,
    profileId: params.profileId,
  });
  return materialization;
};

export const applyCoordinationMembershipDeltasToDirectoryStore = (params: Readonly<{
  communityId: string;
  deltas: ReadonlyArray<import("./community-coordination-membership-client").CoordinationMembershipDeltaRecord>;
  profileId?: string;
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
  return materialization;
};
