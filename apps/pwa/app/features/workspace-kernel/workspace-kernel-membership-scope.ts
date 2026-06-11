import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import {
  loadCommunityMembershipLedger,
  type CommunityMembershipLedgerEntry,
} from "@/app/features/groups/services/community-membership-ledger";
import { listCoordinationMembershipDirectoryRecords } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import { deriveCommunityId, isHashedCommunityId, pickPreferredCommunityId } from "@/app/features/groups/utils/community-identity";

const TERMINAL_LEDGER_STATUSES = new Set(["left", "expelled"]);

export const resolveLedgerCommunityId = (
  entry: Readonly<Pick<CommunityMembershipLedgerEntry, "communityId" | "groupId" | "relayUrl">>,
): string => deriveCommunityId({
  existingCommunityId: entry.communityId,
  groupId: entry.groupId,
  relayUrl: entry.relayUrl,
});

export const findJoinedLedgerEntryForScope = (
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>,
  params: Readonly<{ groupId: string; relayUrl: string }>,
): CommunityMembershipLedgerEntry | undefined => {
  const groupId = params.groupId.trim();
  const relayUrl = params.relayUrl.trim();
  return ledger.find((entry) => (
    entry.groupId.trim() === groupId
    && (entry.relayUrl ?? "").trim() === relayUrl
    && entry.status === "joined"
  ));
};

export const findJoinedLedgerEntryForCommunity = (
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>,
  communityId: string,
): CommunityMembershipLedgerEntry | undefined => {
  const normalizedCommunityId = communityId.trim();
  return ledger.find((entry) => (
    entry.status === "joined"
    && resolveLedgerCommunityId(entry) === normalizedCommunityId
  ));
};

/**
 * Resolve the coordination community id for leave/join/network deltas.
 * Prefers hashed ids from ledger and directory over legacy `groupId:relay` derivation.
 */
export const resolveManagedWorkspaceCommunityId = (params: Readonly<{
  group: Pick<GroupConversation, "communityId" | "groupId" | "relayUrl" | "genesisEventId" | "creatorPubkey">;
  publicKeyHex: PublicKeyHex;
  profileId?: string;
}>): string => {
  const groupId = params.group.groupId.trim();
  const relayUrl = params.group.relayUrl?.trim() ?? "";
  const ledger = loadCommunityMembershipLedger(params.publicKeyHex, { profileId: params.profileId });
  const ledgerScopeEntry = findJoinedLedgerEntryForScope(ledger, { groupId, relayUrl })
    ?? ledger.find((entry) => entry.groupId.trim() === groupId && (entry.relayUrl ?? "").trim() === relayUrl);

  const fromLedger = ledgerScopeEntry ? resolveLedgerCommunityId(ledgerScopeEntry) : undefined;
  const fromGroup = params.group.communityId?.trim() || undefined;
  const fromDirectory = listCoordinationMembershipDirectoryRecords(params.profileId)
    .map((record) => record.communityId)
    .find((communityId) => {
      const ledgerEntry = ledger.find((entry) => (
        resolveLedgerCommunityId(entry) === communityId.trim()
        || entry.communityId?.trim() === communityId.trim()
      ));
      return ledgerEntry?.groupId.trim() === groupId
        && (ledgerEntry.relayUrl ?? "").trim() === relayUrl;
    });

  const preferred = pickPreferredCommunityId(
    pickPreferredCommunityId(fromLedger, fromDirectory),
    fromGroup,
  );

  if (preferred) {
    return preferred;
  }

  return deriveCommunityId({
    existingCommunityId: fromGroup,
    groupId,
    relayUrl,
    genesisEventId: params.group.genesisEventId,
    creatorPubkey: params.group.creatorPubkey,
  });
};

export const hasJoinedLedgerScopeEvidence = (
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>,
  params: Readonly<{ groupId: string; relayUrl: string }>,
): boolean => Boolean(findJoinedLedgerEntryForScope(ledger, params));

/**
 * Ordered community-id candidates for leave/join when legacy metadata disagrees with ledger/directory.
 * Hashed ids are tried before legacy `groupId:relay` derivations.
 */
export const listManagedWorkspaceCommunityIdCandidates = (params: Readonly<{
  group: Pick<GroupConversation, "communityId" | "groupId" | "relayUrl" | "genesisEventId" | "creatorPubkey">;
  publicKeyHex: PublicKeyHex;
  profileId?: string;
}>): ReadonlyArray<string> => {
  const groupId = params.group.groupId.trim();
  const relayUrl = params.group.relayUrl?.trim() ?? "";
  const ledger = loadCommunityMembershipLedger(params.publicKeyHex, { profileId: params.profileId });
  const candidates = new Set<string>();

  const remember = (communityId: string | null | undefined): void => {
    const trimmed = communityId?.trim() ?? "";
    if (trimmed.length > 0) {
      candidates.add(trimmed);
    }
  };

  for (const entry of ledger) {
    if (entry.groupId.trim() !== groupId || (entry.relayUrl ?? "").trim() !== relayUrl) {
      continue;
    }
    remember(entry.communityId);
    remember(resolveLedgerCommunityId(entry));
  }

  for (const record of listCoordinationMembershipDirectoryRecords(params.profileId)) {
    const ledgerEntry = ledger.find((entry) => (
      resolveLedgerCommunityId(entry) === record.communityId.trim()
      || entry.communityId?.trim() === record.communityId.trim()
    ));
    if (
      ledgerEntry
      && ledgerEntry.groupId.trim() === groupId
      && (ledgerEntry.relayUrl ?? "").trim() === relayUrl
    ) {
      remember(record.communityId);
    }
  }

  remember(params.group.communityId);
  remember(resolveManagedWorkspaceCommunityId(params));

  return Array.from(candidates).sort((left, right) => {
    const leftRank = isHashedCommunityId(left) ? 0 : 1;
    const rightRank = isHashedCommunityId(right) ? 0 : 1;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.localeCompare(right);
  });
};

export const hasTerminalLedgerScopeEvidence = (
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>,
  params: Readonly<{ groupId: string; relayUrl: string }>,
): boolean => {
  const groupId = params.groupId.trim();
  const relayUrl = params.relayUrl.trim();
  const entry = ledger.find((candidate) => (
    candidate.groupId.trim() === groupId
    && (candidate.relayUrl ?? "").trim() === relayUrl
  ));
  return Boolean(entry && TERMINAL_LEDGER_STATUSES.has(entry.status));
};
