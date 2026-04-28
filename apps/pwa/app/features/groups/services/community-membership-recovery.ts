import type { GroupConversation } from "@/app/features/messaging/types";
import type {
  CommunityDescriptorProjection,
  CommunityMembershipProjection,
  CommunityMembershipSourceOfTruth,
} from "@dweb/core/community-projection-contracts";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import {
  toCommunityMembershipLedgerEntryFromGroup,
  toCommunityMembershipLedgerKey,
  toGroupConversationFromMembershipLedgerEntry,
} from "./community-membership-ledger";
import { toGroupTombstoneKey } from "./group-tombstone-store";
import { pickPreferredCommunityId } from "../utils/community-identity";

export const COMMUNITY_MEMBERSHIP_RECOVERY_PRECEDENCE = Object.freeze([
  "tombstone",
  "membership_ledger",
  "persisted_chat_state",
] as const);

export type CommunityMembershipRecoveryPrecedence =
  typeof COMMUNITY_MEMBERSHIP_RECOVERY_PRECEDENCE[number];

export type CommunityMembershipRecoveryDiagnostics = Readonly<{
  persistedGroupCount: number;
  persistedDuplicateMergeCount: number;
  ledgerEntryCount: number;
  visibleGroupCount: number;
  hydratedFromPersistedWithLedgerCount: number;
  hydratedFromPersistedFallbackCount: number;
  hydratedFromLedgerOnlyCount: number;
  placeholderDisplayNameRecoveredCount: number;
  localMemberBackfillCount: number;
  hiddenByTombstoneCount: number;
  hiddenByLedgerStatusCount: number;
  missingLedgerCoverageCount: number;
}>;

export type CommunityMembershipRecoveryResult = Readonly<{
  groups: ReadonlyArray<GroupConversation>;
  missingLedgerCoverageEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  descriptorProjections: ReadonlyArray<CommunityDescriptorProjection>;
  membershipProjections: ReadonlyArray<CommunityMembershipProjection>;
  diagnostics: CommunityMembershipRecoveryDiagnostics;
}>;

const toLastMessageUnixMs = (group: GroupConversation): number => {
  const value = group.lastMessageTime?.getTime?.() ?? 0;
  return Number.isFinite(value) ? value : 0;
};

const PLACEHOLDER_GROUP_DISPLAY_NAME = "Private Group";

const normalizeDisplayName = (value: string | undefined): string => (value ?? "").trim();

const hasMeaningfulDisplayName = (value: string | undefined): boolean => {
  const trimmed = normalizeDisplayName(value);
  return trimmed.length > 0 && trimmed !== PLACEHOLDER_GROUP_DISPLAY_NAME;
};

const pickPreferredDisplayName = (
  preferred: string | undefined,
  fallback: string | undefined,
): string => {
  if (hasMeaningfulDisplayName(preferred)) {
    return normalizeDisplayName(preferred);
  }
  if (hasMeaningfulDisplayName(fallback)) {
    return normalizeDisplayName(fallback);
  }
  const preferredTrimmed = normalizeDisplayName(preferred);
  const fallbackTrimmed = normalizeDisplayName(fallback);
  return preferredTrimmed || fallbackTrimmed || PLACEHOLDER_GROUP_DISPLAY_NAME;
};

const uniqueNonEmptyStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)))
);

const mergePersistedGroupEntries = (
  current: GroupConversation,
  incoming: GroupConversation,
): GroupConversation => {
  const incomingIsNewer = toLastMessageUnixMs(incoming) >= toLastMessageUnixMs(current);
  const newer = incomingIsNewer ? incoming : current;
  const older = incomingIsNewer ? current : incoming;
  const mergedMemberPubkeys = uniqueNonEmptyStrings([
    ...(current.memberPubkeys ?? []),
    ...(incoming.memberPubkeys ?? []),
  ]);
  const mergedAdminPubkeys = uniqueNonEmptyStrings([
    ...(current.adminPubkeys ?? []),
    ...(incoming.adminPubkeys ?? []),
  ]);
  const newerAvatar = newer.avatar?.trim();
  const olderAvatar = older.avatar?.trim();
  const newerAbout = newer.about?.trim();
  const olderAbout = older.about?.trim();

  return {
    ...older,
    ...newer,
    displayName: pickPreferredDisplayName(newer.displayName, older.displayName),
    memberPubkeys: mergedMemberPubkeys,
    adminPubkeys: mergedAdminPubkeys,
    memberCount: Math.max(
      current.memberCount ?? 0,
      incoming.memberCount ?? 0,
      mergedMemberPubkeys.length,
    ),
    avatar: newerAvatar && newerAvatar.length > 0
      ? newerAvatar
      : olderAvatar && olderAvatar.length > 0
        ? olderAvatar
        : undefined,
    about: newerAbout && newerAbout.length > 0
      ? newerAbout
      : olderAbout && olderAbout.length > 0
        ? olderAbout
        : undefined,
  };
};

const dedupePersistedGroupsByKey = (
  groups: ReadonlyArray<GroupConversation>,
): Readonly<{
  byKey: ReadonlyMap<string, GroupConversation>;
  duplicateMergeCount: number;
}> => {
  const byKey = new Map<string, GroupConversation>();
  let duplicateMergeCount = 0;
  for (const group of groups) {
    const key = toGroupTombstoneKey({ groupId: group.groupId, relayUrl: group.relayUrl });
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, group);
      continue;
    }
    byKey.set(key, mergePersistedGroupEntries(current, group));
    duplicateMergeCount += 1;
  }
  return {
    byKey,
    duplicateMergeCount,
  };
};

const dedupeLedgerByKey = (
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
): ReadonlyMap<string, CommunityMembershipLedgerEntry> => {
  const byKey = new Map<string, CommunityMembershipLedgerEntry>();
  for (const entry of entries) {
    const key = toCommunityMembershipLedgerKey(entry);
    const current = byKey.get(key);
    if (!current || entry.updatedAtUnixMs >= current.updatedAtUnixMs) {
      byKey.set(key, entry);
    }
  }
  return byKey;
};

const mergePersistedGroupWithLedger = (
  group: GroupConversation,
  entry: CommunityMembershipLedgerEntry,
  localPublicKeyHex: string,
  inviteEvidenceMemberPubkeys: ReadonlyArray<string>,
): GroupConversation => {
  const mergedMemberPubkeys = uniqueNonEmptyStrings([
    ...(group.memberPubkeys ?? []),
    ...inviteEvidenceMemberPubkeys,
    localPublicKeyHex,
  ]);
  return {
    ...group,
    communityId: pickPreferredCommunityId(group.communityId, entry.communityId) ?? group.communityId,
    displayName: pickPreferredDisplayName(group.displayName, entry.displayName),
    memberPubkeys: mergedMemberPubkeys,
    memberCount: Math.max(group.memberCount ?? 0, mergedMemberPubkeys.length, 1),
    avatar: group.avatar ?? entry.avatar,
  };
};

const toDescriptorProjectionFromGroup = (
  group: GroupConversation,
): CommunityDescriptorProjection => ({
  communityId: group.communityId ?? "unknown",
  groupId: group.groupId ?? "unknown",
  conversationId: group.id,
  relayScope: group.relayUrl,
  displayName: group.displayName ?? "Private Group",
  about: group.about,
  avatarUrl: group.avatar,
  lifecycleState: "active",
  visibilityState: "visible",
  lastDescriptorEventId: `recovery:${group.communityId}`,
  lastDescriptorAtUnixMs: toLastMessageUnixMs(group) || Date.now(),
});

const toMembershipProjectionFromGroup = (params: Readonly<{
  group: GroupConversation;
  sourceOfTruth: CommunityMembershipSourceOfTruth;
}>): CommunityMembershipProjection => ({
  communityId: params.group.communityId ?? "unknown",
  status: "joined",
  sourceOfTruth: params.sourceOfTruth,
  joinedAtUnixMs: toLastMessageUnixMs(params.group) || Date.now(),
  lastMembershipEventId: `recovery:${params.group.communityId}`,
  lastMembershipEvidenceAtUnixMs: toLastMessageUnixMs(params.group) || Date.now(),
});

export const resolveCommunityMembershipRecovery = (params: Readonly<{
  publicKeyHex: string;
  persistedGroups: ReadonlyArray<GroupConversation>;
  membershipLedger: ReadonlyArray<CommunityMembershipLedgerEntry>;
  tombstones: ReadonlySet<string>;
  groupMessageAuthorsByConversationId?: Readonly<Record<string, ReadonlyArray<string>>>;
  inviteMemberPubkeysByGroupKey?: Readonly<Record<string, ReadonlyArray<string>>>;
}>): CommunityMembershipRecoveryResult => {
  const persistedDedupe = dedupePersistedGroupsByKey(params.persistedGroups);
  const persistedByKey = persistedDedupe.byKey;
  const ledgerByKey = dedupeLedgerByKey(params.membershipLedger);
  const consumedKeys = new Set<string>();
  const groups: GroupConversation[] = [];
  const missingLedgerCoverageEntries: CommunityMembershipLedgerEntry[] = [];
  const descriptorProjections: CommunityDescriptorProjection[] = [];
  const membershipProjections: CommunityMembershipProjection[] = [];

  let hiddenByTombstoneCount = 0;
  let hiddenByLedgerStatusCount = 0;
  let hydratedFromPersistedWithLedgerCount = 0;
  let hydratedFromPersistedFallbackCount = 0;
  let hydratedFromLedgerOnlyCount = 0;
  let placeholderDisplayNameRecoveredCount = 0;
  let localMemberBackfillCount = 0;

  for (const [key, persistedGroup] of persistedByKey.entries()) {
    const membershipEntry = ledgerByKey.get(key);
    consumedKeys.add(key);

    if (params.tombstones.has(key)) {
      hiddenByTombstoneCount += 1;
      continue;
    }
    if (membershipEntry && membershipEntry.status !== "joined") {
      hiddenByLedgerStatusCount += 1;
      continue;
    }
    if (membershipEntry?.status === "joined") {
      const mergedGroup = mergePersistedGroupWithLedger(
        persistedGroup,
        membershipEntry,
        params.publicKeyHex,
        params.inviteMemberPubkeysByGroupKey?.[key] ?? [],
      );
      if (
        !hasMeaningfulDisplayName(persistedGroup.displayName)
        && hasMeaningfulDisplayName(mergedGroup.displayName)
      ) {
        placeholderDisplayNameRecoveredCount += 1;
      }
      if (!(persistedGroup.memberPubkeys ?? []).includes(params.publicKeyHex)) {
        localMemberBackfillCount += 1;
      }
      groups.push(mergedGroup);
      descriptorProjections.push(toDescriptorProjectionFromGroup(mergedGroup));
      membershipProjections.push(toMembershipProjectionFromGroup({
        group: mergedGroup,
        sourceOfTruth: "ledger",
      }));
      hydratedFromPersistedWithLedgerCount += 1;
      continue;
    }

    const inviteEvidenceMemberPubkeys = uniqueNonEmptyStrings([
      ...(persistedGroup.memberPubkeys ?? []),
      ...(params.inviteMemberPubkeysByGroupKey?.[key] ?? []),
      params.publicKeyHex,
    ]);
    const recoveredPersistedGroup = inviteEvidenceMemberPubkeys.join(",") === (persistedGroup.memberPubkeys ?? []).join(",")
      ? persistedGroup
      : {
        ...persistedGroup,
        memberPubkeys: inviteEvidenceMemberPubkeys,
        memberCount: Math.max(persistedGroup.memberCount ?? 0, inviteEvidenceMemberPubkeys.length, 1),
      };
    groups.push(recoveredPersistedGroup);
    descriptorProjections.push(toDescriptorProjectionFromGroup(recoveredPersistedGroup));
    membershipProjections.push(toMembershipProjectionFromGroup({
      group: recoveredPersistedGroup,
      sourceOfTruth: "persisted_fallback",
    }));
    hydratedFromPersistedFallbackCount += 1;
    missingLedgerCoverageEntries.push(
      toCommunityMembershipLedgerEntryFromGroup(recoveredPersistedGroup, {
        status: "joined",
        updatedAtUnixMs: toLastMessageUnixMs(recoveredPersistedGroup) || Date.now(),
      }),
    );
  }

  for (const [key, membershipEntry] of ledgerByKey.entries()) {
    if (consumedKeys.has(key)) {
      continue;
    }
    if (params.tombstones.has(key)) {
      hiddenByTombstoneCount += 1;
      continue;
    }
    if (membershipEntry.status !== "joined") {
      hiddenByLedgerStatusCount += 1;
      continue;
    }
    const persistedMemberFallback = params.persistedGroups
      .filter((group) => (
        group.groupId === membershipEntry.groupId
        && group.relayUrl === membershipEntry.relayUrl
      ))
      .flatMap((group) => group.memberPubkeys ?? []);
    const conversationId = `community:${membershipEntry.communityId}`;
    const groupMessageAuthorFallback = params.groupMessageAuthorsByConversationId?.[conversationId] ?? [];
    const fallbackMemberPubkeys = uniqueNonEmptyStrings([
      ...persistedMemberFallback,
      ...(params.inviteMemberPubkeysByGroupKey?.[key] ?? []),
      ...groupMessageAuthorFallback,
      params.publicKeyHex,
    ]);
    const recoveredGroup = toGroupConversationFromMembershipLedgerEntry(membershipEntry, {
      fallbackMemberPubkeys,
    });
    groups.push(recoveredGroup);
    descriptorProjections.push(toDescriptorProjectionFromGroup(recoveredGroup));
    membershipProjections.push(toMembershipProjectionFromGroup({
      group: recoveredGroup,
      sourceOfTruth: "ledger",
    }));
    hydratedFromLedgerOnlyCount += 1;
  }

  return {
    groups,
    missingLedgerCoverageEntries,
    descriptorProjections,
    membershipProjections,
    diagnostics: {
      persistedGroupCount: persistedByKey.size,
      persistedDuplicateMergeCount: persistedDedupe.duplicateMergeCount,
      ledgerEntryCount: ledgerByKey.size,
      visibleGroupCount: groups.length,
      hydratedFromPersistedWithLedgerCount,
      hydratedFromPersistedFallbackCount,
      hydratedFromLedgerOnlyCount,
      placeholderDisplayNameRecoveredCount,
      localMemberBackfillCount,
      hiddenByTombstoneCount,
      hiddenByLedgerStatusCount,
      missingLedgerCoverageCount: missingLedgerCoverageEntries.length,
    },
  };
};
