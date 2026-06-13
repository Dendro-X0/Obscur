import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { peerTrustInternals } from "@/app/features/network/hooks/use-peer-trust";
import { listCoordinationMembershipDirectoryRecords } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import type { CoordinationMembershipMaterialization } from "@/app/features/groups/services/community-coordination-membership-materializer";
import { loadCommunityMembershipLedger } from "@/app/features/groups/services/community-membership-ledger";
import { hasDurableCommunityLeaveIntent } from "@/app/features/groups/services/community-membership-leave-intent";
import { resolveCommunityInviteMemberBlocklist } from "@/app/features/groups/services/community-invite-eligibility-read-model";
import { loadGroupTombstones } from "@/app/features/groups/services/group-tombstone-store";
import { hasTerminalLedgerScopeEvidence } from "@/app/features/workspace-kernel/workspace-kernel-membership-scope";
import { isRelationshipSyncExperimentEnabled } from "./relationship-sync-policy";

const normalizePubkey = (value: string): string => value.trim().toLowerCase();

export type RelationshipCommunityMembership = Readonly<{
  communityId: string;
  status: "active" | "left" | "expelled";
}>;

export type RelationshipSyncSnapshot = Readonly<{
  acceptedDmContacts: ReadonlyArray<PublicKeyHex>;
  communityMemberships: ReadonlyArray<RelationshipCommunityMembership>;
}>;

export type RelationshipDriftIssue = Readonly<{
  code:
    | "invite_blocklist_wider_than_directory"
    | "ledger_terminal_while_directory_active"
    | "directory_active_while_ledger_joined_missing";
  communityId: string;
  peerPublicKeyHex: PublicKeyHex;
  detail: string;
}>;

const materializationForPeer = (
  materialization: CoordinationMembershipMaterialization,
  peerPublicKeyHex: PublicKeyHex,
): "active" | "left" | "expelled" | "none" => {
  const peer = normalizePubkey(peerPublicKeyHex);
  const inList = (list: ReadonlyArray<string>): boolean => (
    list.some((entry) => normalizePubkey(entry) === peer)
  );
  if (inList(materialization.activeMemberPubkeys)) {
    return "active";
  }
  if (inList(materialization.leftMemberPubkeys)) {
    return "left";
  }
  if (inList(materialization.expelledMemberPubkeys)) {
    return "expelled";
  }
  return "none";
};

/** DM contact authority for the experiment — peer trust store only. */
export const isDmContactAccepted = (
  ownerPublicKeyHex: PublicKeyHex,
  peerPublicKeyHex: PublicKeyHex,
): boolean => {
  const trust = peerTrustInternals.loadFromStorage(ownerPublicKeyHex);
  const peer = normalizePubkey(peerPublicKeyHex);
  return trust.acceptedPeers.some((entry) => normalizePubkey(entry) === peer);
};

/** Community membership authority for the experiment — coordination directory only. */
export const isCommunityMemberActiveInDirectory = (
  communityId: string,
  peerPublicKeyHex: PublicKeyHex,
  profileId?: string,
): boolean => {
  const record = listCoordinationMembershipDirectoryRecords(profileId)
    .find((entry) => entry.communityId.trim() === communityId.trim());
  if (!record) {
    return false;
  }
  return materializationForPeer(record.materialization, peerPublicKeyHex) === "active";
};

export const buildRelationshipSyncSnapshot = (params: Readonly<{
  ownerPublicKeyHex: PublicKeyHex;
  profileId: string;
}>): RelationshipSyncSnapshot => {
  const trust = peerTrustInternals.loadFromStorage(params.ownerPublicKeyHex);
  const communityMemberships: RelationshipCommunityMembership[] = [];
  for (const record of listCoordinationMembershipDirectoryRecords(params.profileId)) {
    const pushAll = (
      pubkeys: ReadonlyArray<string>,
      status: RelationshipCommunityMembership["status"],
    ): void => {
      for (const pubkey of pubkeys) {
        communityMemberships.push({ communityId: record.communityId, status });
      }
    };
    pushAll(record.materialization.activeMemberPubkeys, "active");
    pushAll(record.materialization.leftMemberPubkeys, "left");
    pushAll(record.materialization.expelledMemberPubkeys, "expelled");
  }

  return {
    acceptedDmContacts: trust.acceptedPeers,
    communityMemberships,
  };
};

/**
 * Compare experiment authorities vs legacy invite widen + ledger hide gates.
 * Returns issues that explain "A sees B but cannot interact" class bugs.
 */
export const detectRelationshipSyncDrift = (params: Readonly<{
  ownerPublicKeyHex: PublicKeyHex;
  profileId: string;
  communityId: string;
  communityMode?: "managed_workspace";
  relayUrl: string;
  coordinationDirectory: CoordinationMembershipMaterialization | null;
  joinEvidenceMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  hybridActiveMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<RelationshipDriftIssue> => {
  if (!isRelationshipSyncExperimentEnabled()) {
    return [];
  }

  const issues: RelationshipDriftIssue[] = [];
  const ledger = loadCommunityMembershipLedger(params.ownerPublicKeyHex, { profileId: params.profileId });
  const tombstones = loadGroupTombstones(params.ownerPublicKeyHex, { profileId: params.profileId });

  const blocklistParams = {
    communityMode: params.communityMode ?? "managed_workspace",
    relayUrl: params.relayUrl,
    coordinationDirectory: params.coordinationDirectory,
    hybridActiveMemberPubkeys: params.hybridActiveMemberPubkeys ?? [],
    joinEvidenceMemberPubkeys: params.joinEvidenceMemberPubkeys ?? [],
  } as const;

  const legacyBlocklist = resolveCommunityInviteMemberBlocklist(
    blocklistParams,
    { joinEvidencePolicy: "legacy" },
  );

  const directoryOnlyBlocklist = resolveCommunityInviteMemberBlocklist(
    blocklistParams,
    { joinEvidencePolicy: "directory_only" },
  );

  const directoryOnlySet = new Set(directoryOnlyBlocklist.map(normalizePubkey));
  for (const pubkey of legacyBlocklist) {
    if (!directoryOnlySet.has(normalizePubkey(pubkey))) {
      issues.push({
        code: "invite_blocklist_wider_than_directory",
        communityId: params.communityId,
        peerPublicKeyHex: pubkey,
        detail: "join-evidence or hybrid widen marks peer in community while directory does not",
      });
    }
  }

  const peersToCheck = new Set<string>([
    ...legacyBlocklist.map(normalizePubkey),
    ...(params.coordinationDirectory?.activeMemberPubkeys ?? []).map(normalizePubkey),
  ]);

  const groupIdGuess = params.communityId.split(":")[0] ?? params.communityId;
  const relayUrl = params.relayUrl;
  const scopedLedger = ledger.find((entry) => (
    (entry.communityId?.trim() === params.communityId.trim()
      || entry.groupId.trim() === groupIdGuess)
    && (entry.relayUrl ?? "").trim() === relayUrl.trim()
  ));

  for (const peerNorm of peersToCheck) {
    if (!peerNorm) {
      continue;
    }
    const peer = peerNorm as PublicKeyHex;
    const directoryActive = isCommunityMemberActiveInDirectory(
      params.communityId,
      peer,
      params.profileId,
    );
    if (!directoryActive) {
      continue;
    }

    const terminalLedger = scopedLedger
      ? hasTerminalLedgerScopeEvidence(ledger, {
        groupId: scopedLedger.groupId,
        relayUrl: scopedLedger.relayUrl ?? relayUrl,
      })
      : false;

    const leaveIntent = hasDurableCommunityLeaveIntent({
      publicKeyHex: params.ownerPublicKeyHex,
      profileId: params.profileId,
      groupId: scopedLedger?.groupId ?? groupIdGuess,
      relayUrl,
      ledgerEntry: scopedLedger,
      tombstones,
    });

    if (terminalLedger || leaveIntent) {
      issues.push({
        code: "ledger_terminal_while_directory_active",
        communityId: params.communityId,
        peerPublicKeyHex: peer,
        detail: terminalLedger
          ? "coordination lists active member but local ledger is terminal"
          : "durable leave intent hides peer while directory still active",
      });
    }
  }

  return issues;
};
