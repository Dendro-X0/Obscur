import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import type { CommunityMembershipLedgerEntry } from "@/app/features/groups/services/community-membership-ledger";
import {
  loadCommunityMembershipLedger,
  toGroupConversationFromMembershipLedgerEntry,
} from "@/app/features/groups/services/community-membership-ledger";
import { applyCommunityMembershipRuntimeEvidence } from "@/app/features/groups/services/community-membership-mutation-owner";
import { loadGroupTombstones, isGroupTombstoned } from "@/app/features/groups/services/group-tombstone-store";
import { deriveCommunityId } from "@/app/features/groups/utils/community-identity";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { enrichWorkspaceGroupConversation } from "@/app/features/groups/services/community-workspace-r1-policy";
import {
  findJoinedLedgerEntryForScope,
  hasTerminalLedgerScopeEvidence,
  resolveLedgerCommunityId,
} from "@/app/features/workspace-kernel/workspace-kernel-membership-scope";
import { listCoordinationMembershipDirectoryRecords } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import type { CoordinationMembershipMaterialization } from "@/app/features/groups/services/community-coordination-membership-materializer";
import { isRelationshipSyncExperimentEnabled } from "./relationship-sync-policy";
import {
  isSelfActiveInDirectoryMaterialization,
  isSelfListedAsTerminalInDirectory,
  qualifiesForDirectoryIncompleteRejoinRepair,
} from "./relationship-sync-directory-sidebar-policy";
import { logAppEvent } from "@/app/shared/log-app-event";

const isSelfActiveInMaterialization = (
  materialization: CoordinationMembershipMaterialization,
  pubkey: PublicKeyHex,
): boolean => isSelfActiveInDirectoryMaterialization(materialization, pubkey);

const communityIdForGroup = (group: GroupConversation): string => (
  deriveCommunityId({
    existingCommunityId: group.communityId,
    groupId: group.groupId,
    relayUrl: group.relayUrl,
  })
);

export const resolveDirectorySidebarScope = (params: Readonly<{
  communityId: string;
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>;
  persistedGroups: ReadonlyArray<GroupConversation>;
}>): Readonly<{ groupId: string; relayUrl: string }> | null => {
  const communityId = params.communityId.trim();
  if (!communityId) {
    return null;
  }

  const ledgerEntry = params.ledger.find((entry) => (
    resolveLedgerCommunityId(entry) === communityId
    || entry.communityId?.trim() === communityId
  ));
  const groupId = ledgerEntry?.groupId.trim() ?? "";
  const relayUrl = (ledgerEntry?.relayUrl ?? "").trim();
  if (groupId && relayUrl) {
    return { groupId, relayUrl };
  }

  const metadataGroup = params.persistedGroups.find((group) => (
    communityIdForGroup(group) === communityId
    || group.communityId?.trim() === communityId
  ));
  if (!metadataGroup) {
    return null;
  }
  const metaGroupId = metadataGroup.groupId.trim();
  const metaRelayUrl = metadataGroup.relayUrl.trim();
  if (!metaGroupId || !metaRelayUrl) {
    return null;
  }
  return { groupId: metaGroupId, relayUrl: metaRelayUrl };
};

const buildDirectoryMaterializedGroup = (params: Readonly<{
  communityId: string;
  groupId: string;
  relayUrl: string;
  ownerPublicKeyHex: PublicKeyHex;
  activeMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  ledgerEntry?: CommunityMembershipLedgerEntry;
  persistedGroup?: GroupConversation;
}>): GroupConversation => {
  if (params.persistedGroup) {
    return enrichWorkspaceGroupConversation({
      ...params.persistedGroup,
      memberPubkeys: params.activeMemberPubkeys.length > 0
        ? params.activeMemberPubkeys
        : params.persistedGroup.memberPubkeys,
      memberCount: Math.max(params.activeMemberPubkeys.length, params.persistedGroup.memberCount ?? 1),
      communityMode: params.persistedGroup.communityMode ?? "managed_workspace",
    });
  }
  if (params.ledgerEntry) {
    return toGroupConversationFromMembershipLedgerEntry(
      { ...params.ledgerEntry, status: "joined" },
      { fallbackMemberPubkeys: params.activeMemberPubkeys },
    );
  }
  const id = toGroupConversationId({
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    communityId: params.communityId,
  });
  return enrichWorkspaceGroupConversation({
    kind: "group",
    id,
    communityId: params.communityId,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    displayName: params.groupId,
    memberPubkeys: params.activeMemberPubkeys.length > 0
      ? params.activeMemberPubkeys
      : [params.ownerPublicKeyHex],
    lastMessage: "",
    unreadCount: 0,
    lastMessageTime: new Date(0),
    access: "invite-only",
    memberCount: Math.max(params.activeMemberPubkeys.length, 1),
    adminPubkeys: [],
    communityMode: "managed_workspace",
  });
};

/** E-REL-2: materialize sidebar rows when coordination lists self active but local hide gates block. */
export const appendDirectoryBackedSidebarGroups = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  persistedGroups: ReadonlyArray<GroupConversation>;
  rememberGroup: (group: GroupConversation) => void;
  hasConversationForScope: (groupId: string, relayUrl: string) => boolean;
}>): number => {
  if (!isRelationshipSyncExperimentEnabled()) {
    return 0;
  }

  let ledger = loadCommunityMembershipLedger(params.publicKeyHex, { profileId: params.profileId });
  const tombstones = loadGroupTombstones(params.publicKeyHex, { profileId: params.profileId });
  let appendedCount = 0;

  for (const row of listCoordinationMembershipDirectoryRecords(params.profileId)) {
    if (!isSelfActiveInMaterialization(row.materialization, params.publicKeyHex)) {
      continue;
    }
    if (isSelfListedAsTerminalInDirectory(row.materialization, params.publicKeyHex)) {
      continue;
    }

    const scope = resolveDirectorySidebarScope({
      communityId: row.communityId,
      ledger,
      persistedGroups: params.persistedGroups,
    });
    if (!scope) {
      continue;
    }

    const { groupId, relayUrl } = scope;
    if (params.hasConversationForScope(groupId, relayUrl)) {
      continue;
    }
    if (isGroupTombstoned(params.publicKeyHex, { groupId, relayUrl }, { profileId: params.profileId })) {
      continue;
    }

    if (!qualifiesForDirectoryIncompleteRejoinRepair({
      publicKeyHex: params.publicKeyHex,
      profileId: params.profileId,
      groupId,
      relayUrl,
      materialization: row.materialization,
      ledger,
    })) {
      logAppEvent({
        name: "relationship.sync.directory_sidebar_skipped",
        level: "info",
        scope: { feature: "relationship_sync", action: "directory_sidebar" },
        context: {
          communityId: row.communityId,
          groupId,
          reason: "leave_evidence_or_directory_terminal",
        },
      });
      continue;
    }

    const ledgerEntry = ledger.find((entry) => (
      entry.groupId.trim() === groupId && (entry.relayUrl ?? "").trim() === relayUrl
    ));
    const persistedGroup = params.persistedGroups.find((group) => (
      group.groupId.trim() === groupId && group.relayUrl.trim() === relayUrl
    ));

    if (hasTerminalLedgerScopeEvidence(ledger, scope)) {
      const repairGroup = buildDirectoryMaterializedGroup({
        communityId: row.communityId,
        groupId,
        relayUrl,
        ownerPublicKeyHex: params.publicKeyHex,
        activeMemberPubkeys: row.materialization.activeMemberPubkeys,
        ledgerEntry,
        persistedGroup,
      });
      applyCommunityMembershipRuntimeEvidence({
        publicKeyHex: params.publicKeyHex,
        profileId: params.profileId,
        evidence: {
          kind: "user_explicit_rejoin",
          group: repairGroup,
        },
        membershipLedger: ledger,
        tombstones,
        relayConfirmed: true,
      });
      ledger = loadCommunityMembershipLedger(params.publicKeyHex, { profileId: params.profileId });
    }

    const joinedEntry = findJoinedLedgerEntryForScope(ledger, scope);
    const materialized = buildDirectoryMaterializedGroup({
      communityId: row.communityId,
      groupId,
      relayUrl,
      ownerPublicKeyHex: params.publicKeyHex,
      activeMemberPubkeys: row.materialization.activeMemberPubkeys,
      ledgerEntry: joinedEntry ?? ledgerEntry,
      persistedGroup,
    });
    params.rememberGroup(materialized);
    appendedCount += 1;
  }

  return appendedCount;
};

export const shouldHideSidebarForExperimentDirectory = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  groupId: string;
  relayUrl: string;
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>;
  persistedGroups: ReadonlyArray<GroupConversation>;
}>): boolean => {
  if (!isRelationshipSyncExperimentEnabled()) {
    return false;
  }

  for (const row of listCoordinationMembershipDirectoryRecords(params.profileId)) {
    if (!isSelfActiveInMaterialization(row.materialization, params.publicKeyHex)) {
      continue;
    }
    if (isSelfListedAsTerminalInDirectory(row.materialization, params.publicKeyHex)) {
      continue;
    }
    const scope = resolveDirectorySidebarScope({
      communityId: row.communityId,
      ledger: params.ledger,
      persistedGroups: params.persistedGroups,
    });
    if (
      scope
      && scope.groupId === params.groupId.trim()
      && scope.relayUrl === params.relayUrl.trim()
      && qualifiesForDirectoryIncompleteRejoinRepair({
        publicKeyHex: params.publicKeyHex,
        profileId: params.profileId,
        groupId: scope.groupId,
        relayUrl: scope.relayUrl,
        materialization: row.materialization,
        ledger: params.ledger,
      })
    ) {
      return true;
    }
  }
  return false;
};
