import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMembershipLedgerEntry } from "@/app/features/groups/services/community-membership-ledger";
import { readCommunityLeaveOutbox } from "@/app/features/groups/services/community-leave-outbox";
import { communityMembershipScopeMatches } from "@/app/features/groups/services/community-membership-scope-key";
import type { CoordinationMembershipMaterialization } from "@/app/features/groups/services/community-coordination-membership-materializer";
import { hasTerminalLedgerScopeEvidence } from "@/app/features/workspace-kernel/workspace-kernel-membership-scope";

const normalizePubkey = (value: string): string => value.trim().toLowerCase();

export const isSelfListedAsTerminalInDirectory = (
  materialization: CoordinationMembershipMaterialization,
  pubkey: PublicKeyHex,
): boolean => {
  const peer = normalizePubkey(pubkey);
  const inList = (list: ReadonlyArray<string>): boolean => (
    list.some((entry) => normalizePubkey(entry) === peer)
  );
  return inList(materialization.leftMemberPubkeys) || inList(materialization.expelledMemberPubkeys);
};

export const isSelfActiveInDirectoryMaterialization = (
  materialization: CoordinationMembershipMaterialization,
  pubkey: PublicKeyHex,
): boolean => {
  const peer = normalizePubkey(pubkey);
  return materialization.activeMemberPubkeys.some((entry) => normalizePubkey(entry) === peer);
};

const hasLeaveOutboxForScope = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  groupId: string;
  relayUrl: string;
}>): boolean => (
  readCommunityLeaveOutbox(params.publicKeyHex, params.profileId).some((item) => (
    communityMembershipScopeMatches(
      { groupId: params.groupId, relayUrl: params.relayUrl },
      { groupId: item.groupId, relayUrl: item.relayUrl },
    )
  ))
);

/**
 * Same gate as hydrate-repair incomplete rejoin: never revive when leave outbox
 * still records an intentional leave (including published). Terminal ledger may
 * only be repaired when outbox was cleared by explicit rejoin.
 */
export const qualifiesForDirectoryIncompleteRejoinRepair = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  groupId: string;
  relayUrl: string;
  materialization: CoordinationMembershipMaterialization;
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>;
}>): boolean => {
  if (!isSelfActiveInDirectoryMaterialization(params.materialization, params.publicKeyHex)) {
    return false;
  }
  if (isSelfListedAsTerminalInDirectory(params.materialization, params.publicKeyHex)) {
    return false;
  }
  if (hasLeaveOutboxForScope(params)) {
    return false;
  }

  if (hasTerminalLedgerScopeEvidence(params.ledger, {
    groupId: params.groupId,
    relayUrl: params.relayUrl,
  })) {
    return true;
  }

  return !findJoinedLedgerEntry(params.ledger, params.groupId, params.relayUrl);
};

const findJoinedLedgerEntry = (
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>,
  groupId: string,
  relayUrl: string,
): CommunityMembershipLedgerEntry | undefined => (
  ledger.find((entry) => (
    entry.groupId.trim() === groupId.trim()
    && (entry.relayUrl ?? "").trim() === relayUrl.trim()
    && entry.status === "joined"
  ))
);
