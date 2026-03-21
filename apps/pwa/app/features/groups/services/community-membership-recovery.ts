import type { GroupConversation } from "@/app/features/messaging/types";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import {
  toCommunityMembershipLedgerEntryFromGroup,
  toCommunityMembershipLedgerKey,
  toGroupConversationFromMembershipLedgerEntry,
} from "./community-membership-ledger";
import { toGroupTombstoneKey } from "./group-tombstone-store";

export const COMMUNITY_MEMBERSHIP_RECOVERY_PRECEDENCE = Object.freeze([
  "tombstone",
  "membership_ledger",
  "persisted_chat_state",
] as const);

export type CommunityMembershipRecoveryPrecedence =
  typeof COMMUNITY_MEMBERSHIP_RECOVERY_PRECEDENCE[number];

export type CommunityMembershipRecoveryDiagnostics = Readonly<{
  persistedGroupCount: number;
  ledgerEntryCount: number;
  visibleGroupCount: number;
  hydratedFromPersistedWithLedgerCount: number;
  hydratedFromPersistedFallbackCount: number;
  hydratedFromLedgerOnlyCount: number;
  hiddenByTombstoneCount: number;
  hiddenByLedgerStatusCount: number;
  missingLedgerCoverageCount: number;
}>;

export type CommunityMembershipRecoveryResult = Readonly<{
  groups: ReadonlyArray<GroupConversation>;
  missingLedgerCoverageEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  diagnostics: CommunityMembershipRecoveryDiagnostics;
}>;

const toLastMessageUnixMs = (group: GroupConversation): number => {
  const value = group.lastMessageTime?.getTime?.() ?? 0;
  return Number.isFinite(value) ? value : 0;
};

const dedupePersistedGroupsByKey = (
  groups: ReadonlyArray<GroupConversation>,
): ReadonlyMap<string, GroupConversation> => {
  const byKey = new Map<string, GroupConversation>();
  for (const group of groups) {
    const key = toGroupTombstoneKey({ groupId: group.groupId, relayUrl: group.relayUrl });
    const current = byKey.get(key);
    if (!current || toLastMessageUnixMs(group) >= toLastMessageUnixMs(current)) {
      byKey.set(key, group);
    }
  }
  return byKey;
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
): GroupConversation => ({
  ...group,
  communityId: entry.communityId || group.communityId,
  displayName: group.displayName?.trim() || entry.displayName || "Private Group",
  avatar: group.avatar ?? entry.avatar,
});

export const resolveCommunityMembershipRecovery = (params: Readonly<{
  publicKeyHex: string;
  persistedGroups: ReadonlyArray<GroupConversation>;
  membershipLedger: ReadonlyArray<CommunityMembershipLedgerEntry>;
  tombstones: ReadonlySet<string>;
}>): CommunityMembershipRecoveryResult => {
  const persistedByKey = dedupePersistedGroupsByKey(params.persistedGroups);
  const ledgerByKey = dedupeLedgerByKey(params.membershipLedger);
  const consumedKeys = new Set<string>();
  const groups: GroupConversation[] = [];
  const missingLedgerCoverageEntries: CommunityMembershipLedgerEntry[] = [];

  let hiddenByTombstoneCount = 0;
  let hiddenByLedgerStatusCount = 0;
  let hydratedFromPersistedWithLedgerCount = 0;
  let hydratedFromPersistedFallbackCount = 0;
  let hydratedFromLedgerOnlyCount = 0;

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
      groups.push(mergePersistedGroupWithLedger(persistedGroup, membershipEntry));
      hydratedFromPersistedWithLedgerCount += 1;
      continue;
    }

    groups.push(persistedGroup);
    hydratedFromPersistedFallbackCount += 1;
    missingLedgerCoverageEntries.push(
      toCommunityMembershipLedgerEntryFromGroup(persistedGroup, {
        status: "joined",
        updatedAtUnixMs: toLastMessageUnixMs(persistedGroup) || Date.now(),
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
    groups.push(toGroupConversationFromMembershipLedgerEntry(membershipEntry, {
      fallbackMemberPubkeys: [params.publicKeyHex],
    }));
    hydratedFromLedgerOnlyCount += 1;
  }

  return {
    groups,
    missingLedgerCoverageEntries,
    diagnostics: {
      persistedGroupCount: persistedByKey.size,
      ledgerEntryCount: ledgerByKey.size,
      visibleGroupCount: groups.length,
      hydratedFromPersistedWithLedgerCount,
      hydratedFromPersistedFallbackCount,
      hydratedFromLedgerOnlyCount,
      hiddenByTombstoneCount,
      hiddenByLedgerStatusCount,
      missingLedgerCoverageCount: missingLedgerCoverageEntries.length,
    },
  };
};

