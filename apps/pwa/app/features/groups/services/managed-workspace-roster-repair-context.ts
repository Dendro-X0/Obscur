import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  findJoinedLedgerEntryForScope,
  listManagedWorkspaceCommunityIdCandidates,
  resolveManagedWorkspaceCommunityId,
} from "@/app/features/workspace-kernel/workspace-kernel-membership-scope";
import { loadCommunityMembershipLedger } from "./community-membership-ledger";
import { loadCommunityKnownParticipantsEntries } from "./community-known-participants-store";
import { resolveEffectiveCommunityMode } from "./community-workspace-r1-policy";

export type ManagedWorkspaceRosterRepairContext = Readonly<{
  resolvedCommunityId: string | undefined;
  communityIdCandidates: ReadonlyArray<string>;
  joinEvidenceMemberPubkeys: ReadonlyArray<PublicKeyHex>;
}>;

/** Resolve coordination ids + join-evidence seeds for existing managed workspace groups. */
export const buildManagedWorkspaceRosterRepairContext = (params: Readonly<{
  group?: GroupConversation | null;
  publicKeyHex?: PublicKeyHex | null;
  profileId?: string;
  routeCommunityIdFallback?: string;
}>): ManagedWorkspaceRosterRepairContext => {
  const profileId = params.profileId ?? getResolvedProfileId();
  const group = params.group;
  const publicKeyHex = params.publicKeyHex?.trim() as PublicKeyHex | undefined;

  if (!group) {
    const fallback = params.routeCommunityIdFallback?.trim() || undefined;
    return {
      resolvedCommunityId: fallback,
      communityIdCandidates: fallback ? [fallback] : [],
      joinEvidenceMemberPubkeys: [],
    };
  }

  const effectiveCommunityMode = resolveEffectiveCommunityMode(group.communityMode, group.relayUrl);
  const usesManagedWorkspaceRepair = effectiveCommunityMode === "managed_workspace";

  const resolvedCommunityId = publicKeyHex && usesManagedWorkspaceRepair
    ? resolveManagedWorkspaceCommunityId({
      group,
      publicKeyHex,
      profileId,
    })
    : (group.communityId?.trim()
      || params.routeCommunityIdFallback?.trim()
      || undefined);

  const communityIdCandidates = publicKeyHex && usesManagedWorkspaceRepair
    ? listManagedWorkspaceCommunityIdCandidates({
      group,
      publicKeyHex,
      profileId,
    })
    : (resolvedCommunityId ? [resolvedCommunityId] : []);

  const joinEvidence = new Set<string>();
  (group.memberPubkeys ?? []).forEach((pubkey) => {
    const trimmed = pubkey.trim();
    if (trimmed) {
      joinEvidence.add(trimmed);
    }
  });
  if (publicKeyHex) {
    const ledger = loadCommunityMembershipLedger(publicKeyHex, { profileId });
    const ledgerEntry = findJoinedLedgerEntryForScope(ledger, {
      groupId: group.groupId,
      relayUrl: group.relayUrl,
    });
    (ledgerEntry?.memberPubkeys ?? []).forEach((pubkey) => {
      const trimmed = pubkey.trim();
      if (trimmed) {
        joinEvidence.add(trimmed);
      }
    });

    const knownEntry = loadCommunityKnownParticipantsEntries(publicKeyHex, profileId).find((entry) => (
      entry.conversationId === group.id
      || (entry.groupId === group.groupId && entry.relayUrl === group.relayUrl)
    ));
    (knownEntry?.participantPubkeys ?? []).forEach((pubkey) => {
      const trimmed = pubkey.trim();
      if (trimmed) {
        joinEvidence.add(trimmed);
      }
    });
  }

  return {
    resolvedCommunityId,
    communityIdCandidates,
    joinEvidenceMemberPubkeys: Array.from(joinEvidence) as PublicKeyHex[],
  };
};
