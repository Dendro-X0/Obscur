import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import { readCommunityLeaveOutbox } from "./community-leave-outbox";
import { toGroupTombstoneKey } from "./group-tombstone-store";

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
  const tombstoneKey = toGroupTombstoneKey({
    groupId: params.groupId,
    relayUrl: params.relayUrl,
  });
  if (params.tombstones.has(tombstoneKey)) {
    return true;
  }
  if (params.ledgerEntry && isTerminalCommunityMembershipLedgerStatus(params.ledgerEntry.status)) {
    return true;
  }
  return readCommunityLeaveOutbox(params.publicKeyHex, params.profileId).some((item) => (
    item.groupId === params.groupId && item.relayUrl === params.relayUrl
  ));
};
