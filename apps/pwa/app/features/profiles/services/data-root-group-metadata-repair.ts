import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import { messagingChatStateMessagePort } from "@/app/features/messaging/services/messaging-chat-state-message-port";
import { fromPersistedGroupConversation, toPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";
import { loadSqliteGroupPersistedRows } from "@/app/features/groups/services/community-group-sqlite-store";
import { accountHasSqliteGroupMessageEvidence } from "@/app/features/groups/services/account-group-sqlite-evidence";
import {
  loadCommunityMembershipLedger,
  mergeCommunityMembershipLedgerEntries,
  parseCommunityMembershipLedgerSnapshot,
  saveCommunityMembershipLedger,
  toCommunityMembershipLedgerEntryFromGroup,
  toGroupConversationFromMembershipLedgerEntry,
  type CommunityMembershipLedgerEntry,
} from "@/app/features/groups/services/community-membership-ledger";
import { saveCoordinationMembershipDirectory } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import type { CoordinationMembershipMaterialization } from "@/app/features/groups/services/community-coordination-membership-materializer";
import { readCommunityLeaveOutbox } from "@/app/features/groups/services/community-leave-outbox";
import { communityMembershipScopeMatches } from "@/app/features/groups/services/community-membership-scope-key";
import { isGroupTombstoned } from "@/app/features/groups/services/group-tombstone-store";
import {
  isSelfActiveInDirectoryMaterialization,
  isSelfListedAsTerminalInDirectory,
} from "@/app/features/relationship-sync/relationship-sync-directory-sidebar-policy";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";
import {
  harvestProfileWebStorage,
  listHarvestedJoinedLedgerEntriesAcrossProfiles,
  listHarvestedLedgerEntriesForPubkey,
  type ProfileWebStorageHarvestResult,
} from "@/app/features/profiles/services/profile-web-storage-harvest-service";
import { isTauri } from "@dweb/db";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

const groupScopeKey = (group: Readonly<{ groupId: string; relayUrl?: string }>): string => (
  `${group.groupId.trim()}@@${(group.relayUrl ?? "").trim()}`
);

const normalizePubkey = (value: string): string => value.trim().toLowerCase();

const includesPubkey = (
  memberPubkeys: ReadonlyArray<string> | undefined,
  publicKeyHex: PublicKeyHex,
): boolean => (
  (memberPubkeys ?? []).some((entry) => normalizePubkey(entry) === normalizePubkey(publicKeyHex))
);

const isMaterialization = (value: unknown): value is CoordinationMembershipMaterialization => (
  !!value
  && typeof value === "object"
  && Array.isArray((value as CoordinationMembershipMaterialization).activeMemberPubkeys)
);

const restoreHarvestedDirectorySnapshots = (
  harvest: ProfileWebStorageHarvestResult,
  profileId: string,
): number => {
  let restoredCount = 0;
  harvest.directories.forEach((snapshot) => {
    snapshot.records.forEach((record) => {
      const communityId = typeof record.communityId === "string" ? record.communityId.trim() : "";
      const materialization = record.materialization;
      if (!communityId || !isMaterialization(materialization)) {
        return;
      }
      saveCoordinationMembershipDirectory({
        communityId,
        materialization,
        profileId,
      });
      restoredCount += 1;
    });
  });
  return restoredCount;
};

const hasLeaveOutboxForScope = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
  groupId: string,
  relayUrl: string,
): boolean => (
  readCommunityLeaveOutbox(publicKeyHex, profileId).some((item) => (
    communityMembershipScopeMatches(
      { groupId, relayUrl },
      { groupId: item.groupId, relayUrl: item.relayUrl },
    )
  ))
);

const isScopeRevivalBlocked = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
  entry: CommunityMembershipLedgerEntry,
): boolean => (
  isGroupTombstoned(
    publicKeyHex,
    { groupId: entry.groupId, relayUrl: entry.relayUrl },
    { profileId },
  )
  || hasLeaveOutboxForScope(
    publicKeyHex,
    profileId,
    entry.groupId.trim(),
    (entry.relayUrl ?? "").trim(),
  )
);

const reviveFromHarvestedDirectoryActiveMembership = (
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>,
  harvest: ProfileWebStorageHarvestResult,
  publicKeyHex: PublicKeyHex,
  profileId: string,
): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  const directoryRecords = harvest.directories.flatMap((snapshot) => snapshot.records);
  return ledger.map((entry) => {
    if (entry.status !== "left") {
      return entry;
    }
    if (isScopeRevivalBlocked(publicKeyHex, profileId, entry)) {
      return entry;
    }
    const communityId = entry.communityId?.trim() ?? "";
    if (!communityId) {
      return entry;
    }
    const directoryRecord = directoryRecords.find((record) => (
      typeof record.communityId === "string" && record.communityId.trim() === communityId
    ));
    const materialization = directoryRecord?.materialization;
    if (!isMaterialization(materialization)) {
      return entry;
    }
    if (
      isSelfActiveInDirectoryMaterialization(materialization, publicKeyHex)
      && !isSelfListedAsTerminalInDirectory(materialization, publicKeyHex)
    ) {
      return {
        ...entry,
        status: "joined",
        updatedAtUnixMs: Math.max(Number(entry.updatedAtUnixMs ?? 0), Date.now()),
      };
    }
    return entry;
  });
};

const reviveStaleTerminalEntriesFromPeerJoinedEvidence = (
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>,
  harvest: ProfileWebStorageHarvestResult,
  publicKeyHex: PublicKeyHex,
  profileId: string,
): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  const joinedEvidence = listHarvestedJoinedLedgerEntriesAcrossProfiles(harvest);
  return ledger.map((entry) => {
    if (entry.status !== "left") {
      return entry;
    }
    if (isScopeRevivalBlocked(publicKeyHex, profileId, entry)) {
      return entry;
    }
    const scopeKey = groupScopeKey(entry);
    const peerJoined = joinedEvidence.find((candidate) => (
      groupScopeKey({
        groupId: String(candidate.groupId ?? ""),
        relayUrl: typeof candidate.relayUrl === "string" ? candidate.relayUrl : "",
      }) === scopeKey
      && includesPubkey(
        Array.isArray(candidate.memberPubkeys)
          ? candidate.memberPubkeys.filter((value): value is string => typeof value === "string")
          : undefined,
        publicKeyHex,
      )
      && (Number(candidate.updatedAtUnixMs ?? 0) >= Number(entry.updatedAtUnixMs ?? 0))
    ));
    if (!peerJoined) {
      return entry;
    }
    return {
      ...entry,
      status: "joined",
      displayName: entry.displayName ?? (typeof peerJoined.displayName === "string" ? peerJoined.displayName : undefined),
      communityId: entry.communityId ?? (typeof peerJoined.communityId === "string" ? peerJoined.communityId : undefined),
      memberPubkeys: entry.memberPubkeys
        ?? (Array.isArray(peerJoined.memberPubkeys)
          ? peerJoined.memberPubkeys.filter((value): value is string => typeof value === "string")
          : undefined),
      adminPubkeys: entry.adminPubkeys
        ?? (Array.isArray(peerJoined.adminPubkeys)
          ? peerJoined.adminPubkeys.filter((value): value is string => typeof value === "string")
          : undefined),
      updatedAtUnixMs: Math.max(Number(entry.updatedAtUnixMs ?? 0), Number(peerJoined.updatedAtUnixMs ?? 0), Date.now()),
    };
  });
};

const mergeHarvestedLedgerForPubkey = (
  current: ReadonlyArray<CommunityMembershipLedgerEntry>,
  harvest: ProfileWebStorageHarvestResult,
  publicKeyHex: PublicKeyHex,
  profileId: string,
): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  const harvestedEntries = parseCommunityMembershipLedgerSnapshot(
    listHarvestedLedgerEntriesForPubkey(harvest, publicKeyHex),
  );
  const merged = mergeCommunityMembershipLedgerEntries(current, harvestedEntries);
  const withDirectoryRevival = reviveFromHarvestedDirectoryActiveMembership(merged, harvest, publicKeyHex, profileId);
  return reviveStaleTerminalEntriesFromPeerJoinedEvidence(withDirectoryRevival, harvest, publicKeyHex, profileId);
};

const materializeGroupsFromJoinedLedger = (
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>,
): ReadonlyArray<GroupConversation> => (
  ledger
    .filter((entry) => entry.status === "joined")
    .map((entry) => toGroupConversationFromMembershipLedgerEntry(entry))
);

/**
 * After a data-root move/import, WebView chat-state can be sparse while native SQLite
 * still holds group rows written under this or sibling profile slots.
 */
export const repairGroupMetadataFromSqliteIfSparse = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
}>): Promise<number> => {
  if (!requiresSqlitePersistence() || !isTauri()) {
    return 0;
  }

  const persisted = messagingChatStateMessagePort.load(params.publicKeyHex, { profileId: params.profileId });
  const existingGroups = (persisted?.createdGroups ?? []).map((row) => fromPersistedGroupConversation(row));

  const profileSlots = listAccountSharedSqliteProfileIds({
    primaryProfileId: params.profileId,
    accountPublicKeyHex: params.publicKeyHex,
  });

  const sqliteGroups = new Map<string, GroupConversation>();
  for (const slotId of profileSlots) {
    const rows = await loadSqliteGroupPersistedRows(slotId, params.publicKeyHex);
    for (const row of rows) {
      const hasMemberEvidence = includesPubkey(row.memberPubkeys, params.publicKeyHex);
      const hasMessageEvidence = hasMemberEvidence || await accountHasSqliteGroupMessageEvidence({
        profileId: slotId,
        groupId: row.groupId,
        accountPublicKeyHex: params.publicKeyHex,
      });
      if (!hasMessageEvidence) {
        continue;
      }
      const group = fromPersistedGroupConversation(row);
      if (group) {
        sqliteGroups.set(groupScopeKey(group), group);
      }
    }
  }

  if (sqliteGroups.size === 0 || existingGroups.length >= sqliteGroups.size) {
    return 0;
  }

  const merged = new Map<string, GroupConversation>();
  existingGroups.forEach((group) => {
    merged.set(groupScopeKey(group), group);
  });
  sqliteGroups.forEach((group, key) => {
    if (!merged.has(key)) {
      merged.set(key, group);
    }
  });

  const nextGroups = Array.from(merged.values());
  messagingChatStateMessagePort.update(
    params.publicKeyHex,
    (prev) => ({
      ...prev,
      createdGroups: nextGroups.map((group) => toPersistedGroupConversation(group)),
    }),
    { profileId: params.profileId, debounceMs: 0 },
  );

  const ledger = loadCommunityMembershipLedger(params.publicKeyHex, { profileId: params.profileId });
  const joinedLedgerKeys = new Set(
    ledger
      .filter((entry) => entry.status === "joined")
      .map((entry) => groupScopeKey({ groupId: entry.groupId, relayUrl: entry.relayUrl })),
  );
  const missingLedgerEntries = nextGroups
    .filter((group) => !joinedLedgerKeys.has(groupScopeKey(group)))
    .map((group) => toCommunityMembershipLedgerEntryFromGroup(group, {
      status: "joined",
      updatedAtUnixMs: Date.now(),
    }));

  if (missingLedgerEntries.length > 0) {
    saveCommunityMembershipLedger(params.publicKeyHex, [...ledger, ...missingLedgerEntries], {
      profileId: params.profileId,
    });
  }

  return nextGroups.length - existingGroups.length;
};

/**
 * Harvest sibling profile WebView storage (including default AppData when present) and
 * repair terminal "left" ledger rows when another profile slot still has joined evidence.
 */
export const repairGroupMetadataFromSiblingWebStorage = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
}>): Promise<number> => {
  if (!requiresSqlitePersistence() || !isTauri()) {
    return 0;
  }

  const harvest = await harvestProfileWebStorage({ includeDefaultAppData: true });
  restoreHarvestedDirectorySnapshots(harvest, params.profileId);

  const currentLedger = loadCommunityMembershipLedger(params.publicKeyHex, { profileId: params.profileId });
  const mergedLedger = mergeHarvestedLedgerForPubkey(
    currentLedger,
    harvest,
    params.publicKeyHex,
    params.profileId,
  );
  const joinedBefore = currentLedger.filter((entry) => entry.status === "joined").length;
  const joinedAfter = mergedLedger.filter((entry) => entry.status === "joined").length;
  if (joinedAfter <= joinedBefore && mergedLedger.length === currentLedger.length) {
    return 0;
  }

  saveCommunityMembershipLedger(params.publicKeyHex, mergedLedger, {
    profileId: params.profileId,
  });

  const persisted = messagingChatStateMessagePort.load(params.publicKeyHex, { profileId: params.profileId });
  const existingGroups = (persisted?.createdGroups ?? []).map((row) => fromPersistedGroupConversation(row));
  const existingByScope = new Map<string, GroupConversation>();
  existingGroups.forEach((group) => {
    if (group) {
      existingByScope.set(groupScopeKey(group), group);
    }
  });

  materializeGroupsFromJoinedLedger(mergedLedger).forEach((group) => {
    if (!existingByScope.has(groupScopeKey(group))) {
      existingByScope.set(groupScopeKey(group), group);
    }
  });

  const nextGroups = Array.from(existingByScope.values());
  messagingChatStateMessagePort.update(
    params.publicKeyHex,
    (prev) => ({
      ...prev,
      createdGroups: nextGroups.map((group) => toPersistedGroupConversation(group)),
    }),
    { profileId: params.profileId, debounceMs: 0 },
  );

  return joinedAfter - joinedBefore;
};

export const repairGroupMetadataAfterStorageLoss = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
}>): Promise<number> => {
  const sqliteRestored = await repairGroupMetadataFromSqliteIfSparse(params);
  const siblingRestored = await repairGroupMetadataFromSiblingWebStorage(params);
  return sqliteRestored + siblingRestored;
};
