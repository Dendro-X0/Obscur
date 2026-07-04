import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "../types";
import { publishCoordinationMembershipDelta } from "./community-coordination-membership-client";
import {
  loadCoordinationMembershipDirectory,
  refreshCoordinationMembershipDirectory,
} from "./community-coordination-membership-directory-store";
import { findJoinedLedgerEntryForScope } from "@/app/features/workspace-kernel/workspace-kernel-membership-scope";
import { loadCommunityMembershipLedger } from "./community-membership-ledger";
import { shouldUseCoordinationMembershipAuthority } from "./community-workspace-r1-policy";

const isPubkeyActiveInDirectory = (
  directory: Readonly<{ activeMemberPubkeys: ReadonlyArray<string> }>,
  pubkey: PublicKeyHex,
): boolean => {
  const normalized = pubkey.trim().toLowerCase();
  return directory.activeMemberPubkeys.some(
    (entry) => entry.trim().toLowerCase() === normalized,
  );
};

/**
 * When ledger says joined but coordination directory omits the local member,
 * republish a join delta so reconcile can converge (COM-RUN-05 recovery).
 */
export const attemptManagedWorkspaceCoordinationSelfHeal = async (params: Readonly<{
  groupId: string;
  relayUrl: string;
  communityId: string;
  communityIdCandidates?: ReadonlyArray<string>;
  communityMode?: CommunityMode | null;
  profileId?: string;
  localMemberPubkey: PublicKeyHex;
  actorPrivateKeyHex: PrivateKeyHex;
}>): Promise<Readonly<{ attempted: boolean; healed: boolean; errorMessage?: string }>> => {
  if (!shouldUseCoordinationMembershipAuthority(params.communityMode, params.relayUrl)) {
    return { attempted: false, healed: false };
  }

  const ledger = loadCommunityMembershipLedger(params.localMemberPubkey, {
    profileId: params.profileId,
  });
  const ledgerEntry = findJoinedLedgerEntryForScope(ledger, {
    groupId: params.groupId,
    relayUrl: params.relayUrl,
  });
  if (!ledgerEntry || ledgerEntry.status !== "joined") {
    return { attempted: false, healed: false };
  }

  const candidates = Array.from(new Set(
    [
      params.communityId.trim(),
      ...(params.communityIdCandidates ?? []),
    ].filter((value) => value.length > 0),
  ));
  if (candidates.length === 0) {
    return { attempted: false, healed: false, errorMessage: "missing_community_id" };
  }

  for (const communityId of candidates) {
    const directory = loadCoordinationMembershipDirectory(communityId, params.profileId);
    if (directory && isPubkeyActiveInDirectory(directory, params.localMemberPubkey)) {
      return { attempted: false, healed: true };
    }
  }

  const primaryCommunityId = candidates[0]!;
  const publish = await publishCoordinationMembershipDelta({
    communityId: primaryCommunityId,
    action: "join",
    subjectPubkey: params.localMemberPubkey,
    actorPubkey: params.localMemberPubkey,
    actorPrivateKeyHex: params.actorPrivateKeyHex,
  });
  if (!publish.success) {
    return {
      attempted: true,
      healed: false,
      errorMessage: publish.errorMessage ?? "coordination_join_republish_failed",
    };
  }

  await refreshCoordinationMembershipDirectory({
    communityId: primaryCommunityId,
    profileId: params.profileId,
    forceFull: true,
  });

  const refreshed = loadCoordinationMembershipDirectory(primaryCommunityId, params.profileId);
  return {
    attempted: true,
    healed: Boolean(refreshed && isPubkeyActiveInDirectory(refreshed, params.localMemberPubkey)),
    errorMessage: refreshed && isPubkeyActiveInDirectory(refreshed, params.localMemberPubkey)
      ? undefined
      : "coordination_join_republish_unconfirmed",
  };
};
