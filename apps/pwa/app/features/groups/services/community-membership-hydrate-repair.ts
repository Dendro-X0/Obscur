import type { GroupConversation } from "@/app/features/messaging/types";
import { logAppEvent } from "@/app/shared/log-app-event";
import { readCommunityLeaveOutbox } from "./community-leave-outbox";
import {
  loadCommunityMembershipLedger,
} from "./community-membership-ledger";
import { applyCommunityMembershipRuntimeEvidence } from "./community-membership-mutation-owner";
import {
  clearDurableCommunityLeaveIntentOnExplicitRejoin,
  hasDurableCommunityLeaveIntent,
  isTerminalCommunityMembershipLedgerStatus,
} from "./community-membership-leave-intent";
import { communityMembershipScopeMatches, communityMembershipScopeMatchesStorageKey } from "./community-membership-scope-key";
import { loadGroupTombstones } from "./group-tombstone-store";

const isScopeTombstoned = (
  tombstones: ReadonlySet<string>,
  groupId: string,
  relayUrl: string,
): boolean => (
  Array.from(tombstones).some((tombstoneKey) => (
    communityMembershipScopeMatchesStorageKey({ groupId, relayUrl }, tombstoneKey)
  ))
);

export type CommunityMembershipHydrateRepairResult = Readonly<{
  clearedHideGateCount: number;
  revivedFromPersistedEvidenceCount: number;
}>;

/**
 * Repair split-brain leave/rejoin state before membership coordinator hydrate.
 * Joined ledger rows supersede stale hide gates; persisted group rows revive
 * incomplete rejoin writes (live UI updated, durable ledger still terminal).
 */
export const repairCommunityMembershipDurableStateOnHydrate = (params: Readonly<{
  publicKeyHex: string;
  profileId: string;
  persistedGroups: ReadonlyArray<GroupConversation>;
}>): CommunityMembershipHydrateRepairResult => {
  let clearedHideGateCount = 0;
  let revivedFromPersistedEvidenceCount = 0;
  const tombstones = loadGroupTombstones(params.publicKeyHex, { profileId: params.profileId });
  let membershipLedger = loadCommunityMembershipLedger(params.publicKeyHex, { profileId: params.profileId });

  for (const entry of membershipLedger) {
    if (entry.status !== "joined") {
      continue;
    }
    const groupId = entry.groupId?.trim() ?? "";
    const relayUrl = entry.relayUrl?.trim() ?? "";
    if (groupId.length === 0 || relayUrl.length === 0) {
      continue;
    }
    const hadOutbox = readCommunityLeaveOutbox(params.publicKeyHex, params.profileId).some((item) => (
      communityMembershipScopeMatches({ groupId, relayUrl }, {
        groupId: item.groupId,
        relayUrl: item.relayUrl,
      })
    ));
    const hadTombstone = Array.from(tombstones).some((tombstoneKey) => (
      communityMembershipScopeMatchesStorageKey({ groupId, relayUrl }, tombstoneKey)
    ));
    if (!hadOutbox && !hadTombstone) {
      continue;
    }
    clearDurableCommunityLeaveIntentOnExplicitRejoin({
      publicKeyHex: params.publicKeyHex,
      groupId,
      relayUrl,
      profileId: params.profileId,
    });
    clearedHideGateCount += 1;
  }

  for (const group of params.persistedGroups) {
    const groupId = group.groupId?.trim() ?? "";
    const relayUrl = group.relayUrl?.trim() ?? "";
    if (groupId.length === 0 || relayUrl.length === 0) {
      continue;
    }
    const scope = { groupId, relayUrl };
    const ledgerEntry = membershipLedger.find((entry) => (
      communityMembershipScopeMatches(scope, {
        groupId: entry.groupId,
        relayUrl: entry.relayUrl ?? "",
      })
    ));
    if (ledgerEntry?.status === "joined") {
      continue;
    }
    if (isScopeTombstoned(tombstones, groupId, relayUrl)) {
      continue;
    }
    const hasLeaveOutbox = readCommunityLeaveOutbox(params.publicKeyHex, params.profileId).some((item) => (
      communityMembershipScopeMatches({ groupId, relayUrl }, {
        groupId: item.groupId,
        relayUrl: item.relayUrl,
      })
    ));
    const incompleteRejoin = (
      !hasLeaveOutbox
      && ledgerEntry !== undefined
      && isTerminalCommunityMembershipLedgerStatus(ledgerEntry.status)
    );
    if (!incompleteRejoin) {
      const leaveIntent = hasDurableCommunityLeaveIntent({
        publicKeyHex: params.publicKeyHex,
        profileId: params.profileId,
        groupId,
        relayUrl,
        ledgerEntry,
        tombstones: loadGroupTombstones(params.publicKeyHex, { profileId: params.profileId }),
      });
      if (!leaveIntent || !hasLeaveOutbox) {
        continue;
      }
    }
    applyCommunityMembershipRuntimeEvidence({
      publicKeyHex: params.publicKeyHex,
      profileId: params.profileId,
      evidence: {
        kind: "user_explicit_rejoin",
        group,
      },
      membershipLedger,
      tombstones: loadGroupTombstones(params.publicKeyHex, { profileId: params.profileId }),
    });
    membershipLedger = loadCommunityMembershipLedger(params.publicKeyHex, { profileId: params.profileId });
    revivedFromPersistedEvidenceCount += 1;
  }

  if (clearedHideGateCount > 0 || revivedFromPersistedEvidenceCount > 0) {
    logAppEvent({
      name: "groups.membership_hydrate_repair",
      level: "info",
      scope: { feature: "groups", action: "membership_hydrate_repair" },
      context: {
        publicKeySuffix: params.publicKeyHex.slice(-8),
        profileId: params.profileId,
        clearedHideGateCount,
        revivedFromPersistedEvidenceCount,
      },
    });
  }

  return {
    clearedHideGateCount,
    revivedFromPersistedEvidenceCount,
  };
};
