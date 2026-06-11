import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import { readCommunityLeaveOutbox, removeCommunityLeaveOutboxItem } from "./community-leave-outbox";
import { removeGroupTombstonesForScope } from "./group-tombstone-store";
import { communityMembershipScopeMatches, communityMembershipScopeMatchesStorageKey } from "./community-membership-scope-key";

const TERMINAL_MEMBERSHIP_STATUSES = new Set(["left", "expelled"]);

export const isTerminalCommunityMembershipLedgerStatus = (
  status: CommunityMembershipLedgerEntry["status"] | string | undefined,
): boolean => (
  typeof status === "string" && TERMINAL_MEMBERSHIP_STATUSES.has(status)
);

/**
 * Durable local leave intent — blocks persisted_fallback resurrection (REL-001).
 * Sources: terminal ledger, tombstone, or leave outbox (pending/rate_limited/rejected).
 */
export const hasDurableCommunityLeaveIntent = (params: Readonly<{
  publicKeyHex: string;
  groupId: string;
  relayUrl: string;
  profileId?: string;
  ledgerEntry?: CommunityMembershipLedgerEntry;
  tombstones: ReadonlySet<string>;
}>): boolean => {
  const scope = { groupId: params.groupId, relayUrl: params.relayUrl };
  if (params.ledgerEntry?.status === "joined") {
    return false;
  }
  for (const tombstoneKey of params.tombstones) {
    if (communityMembershipScopeMatchesStorageKey(scope, tombstoneKey)) {
      return true;
    }
  }
  if (params.ledgerEntry && isTerminalCommunityMembershipLedgerStatus(params.ledgerEntry.status)) {
    return true;
  }
  return readCommunityLeaveOutbox(params.publicKeyHex, params.profileId).some((item) => (
    communityMembershipScopeMatches(scope, {
      groupId: item.groupId,
      relayUrl: item.relayUrl,
    })
  ));
};

/** Clears durable leave gates after an explicit user rejoin (invite accept, allowRevive addGroup). */
export const clearDurableCommunityLeaveIntentOnExplicitRejoin = (params: Readonly<{
  publicKeyHex: string;
  groupId: string;
  relayUrl: string;
  profileId?: string;
}>): void => {
  removeCommunityLeaveOutboxItem({
    publicKeyHex: params.publicKeyHex,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    profileId: params.profileId,
  });
  removeGroupTombstonesForScope(
    params.publicKeyHex,
    { groupId: params.groupId, relayUrl: params.relayUrl },
    { profileId: params.profileId },
  );
};
