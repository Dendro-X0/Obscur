import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { loadCoordinationMembershipDirectory } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import { evaluateJoinerMembershipRepairReadModels } from "@/app/features/groups/services/community-joiner-membership-repair-scenario";
import { resolveCommunityInviteMemberBlocklist } from "@/app/features/groups/services/community-invite-eligibility-read-model";
import { resolveCommunityParticipantDisplayPubkeys } from "@/app/features/groups/services/community-participant-display-read-model";
import {
  enrichWorkspaceGroupConversation,
  resolveEffectiveCommunityMode,
  shouldUseCoordinationMembershipAuthority,
} from "@/app/features/groups/services/community-workspace-r1-policy";
import { isStrictManagedWorkspaceRelay } from "@/app/features/groups/services/strict-managed-workspace";
import { buildManagedWorkspaceRosterRepairContext } from "@/app/features/groups/services/managed-workspace-roster-repair-context";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { loadWorkspaceGroupMetadataRecords } from "@/app/features/workspace-kernel/workspace-kernel-group-metadata-store";
import { resolveManagedWorkspaceGroupList } from "@/app/features/workspace-kernel/workspace-kernel-list-port";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { isDevLabEnabled } from "./dev-lab-policy";

export type DevLabJoinerMembershipProbeGroupResult = Readonly<{
  groupId: string;
  relayUrl: string;
  effectiveCommunityMode: string | undefined;
  joinEvidenceCount: number;
  directoryActiveCount: number;
  displayCount: number;
  blocklistCount: number;
  passed: boolean;
  issues: ReadonlyArray<string>;
}>;

export type DevLabJoinerMembershipProbeResult = Readonly<{
  ok: boolean;
  skipped: boolean;
  reason: string;
  kernelAuthority: boolean;
  synthetic: boolean;
  groupsChecked: number;
  groups: ReadonlyArray<DevLabJoinerMembershipProbeGroupResult>;
}>;

const normalizePubkey = (pubkey: string): string => pubkey.trim().toLowerCase();

const includesPubkey = (
  pubkeys: ReadonlyArray<PublicKeyHex>,
  target: PublicKeyHex,
): boolean => pubkeys.some((entry) => normalizePubkey(entry) === normalizePubkey(target));

const probeGroup = (params: Readonly<{
  group: ReturnType<typeof enrichWorkspaceGroupConversation>;
  publicKeyHex: PublicKeyHex;
  profileId: string;
}>): DevLabJoinerMembershipProbeGroupResult => {
  const { group, publicKeyHex, profileId } = params;
  const relayUrl = group.relayUrl ?? "";
  const effectiveCommunityMode = resolveEffectiveCommunityMode(group.communityMode, relayUrl);
  const repair = buildManagedWorkspaceRosterRepairContext({
    group,
    publicKeyHex,
    profileId,
  });
  const joinEvidence = repair.joinEvidenceMemberPubkeys;
  const directory = repair.resolvedCommunityId
    ? loadCoordinationMembershipDirectory(repair.resolvedCommunityId, profileId)
    : null;
  const directoryActive = directory?.activeMemberPubkeys ?? [];
  const display = resolveCommunityParticipantDisplayPubkeys({
    communityMode: effectiveCommunityMode,
    relayUrl,
    coordinationDirectory: directory,
    monotonicDisplayPubkeys: directoryActive.length > 0 ? directoryActive : [publicKeyHex],
    joinEvidenceMemberPubkeys: joinEvidence,
    localMemberPubkey: publicKeyHex,
  });
  const blocklist = resolveCommunityInviteMemberBlocklist({
    communityMode: effectiveCommunityMode,
    relayUrl,
    coordinationDirectory: directory,
    hybridActiveMemberPubkeys: directoryActive.length > 0 ? directoryActive : [publicKeyHex],
    joinEvidenceMemberPubkeys: joinEvidence,
    leftMemberPubkeys: directory?.leftMemberPubkeys ?? [],
    expelledMemberPubkeys: directory?.expelledMemberPubkeys ?? [],
  });

  const issues: string[] = [];
  if (!shouldUseCoordinationMembershipAuthority(group.communityMode, relayUrl)) {
    issues.push("coordination_authority_inactive");
  }
  if (joinEvidence.length >= 2 && directoryActive.length < joinEvidence.length) {
    for (const pubkey of joinEvidence) {
      if (!includesPubkey(display, pubkey)) {
        issues.push(`display_missing_${normalizePubkey(pubkey).slice(0, 8)}`);
      }
      if (!includesPubkey(blocklist, pubkey)) {
        issues.push(`invite_blocklist_missing_${normalizePubkey(pubkey).slice(0, 8)}`);
      }
    }
  }

  return {
    groupId: group.groupId,
    relayUrl,
    effectiveCommunityMode,
    joinEvidenceCount: joinEvidence.length,
    directoryActiveCount: directoryActive.length,
    displayCount: display.length,
    blocklistCount: blocklist.length,
    passed: issues.length === 0,
    issues,
  };
};

const runSyntheticJoinerMembershipRepairProbe = (): DevLabJoinerMembershipProbeResult => {
  const scenario = evaluateJoinerMembershipRepairReadModels();
  return {
    ok: scenario.ok,
    skipped: false,
    reason: scenario.ok ? "synthetic_joiner_repair_ok" : "synthetic_joiner_repair_failed",
    kernelAuthority: false,
    synthetic: true,
    groupsChecked: 1,
    groups: [{
      groupId: "newtest-2",
      relayUrl: "ws://localhost:7000",
      effectiveCommunityMode: scenario.effectiveCommunityMode,
      joinEvidenceCount: scenario.displayPubkeys.length,
      directoryActiveCount: 1,
      displayCount: scenario.displayPubkeys.length,
      blocklistCount: scenario.blocklistPubkeys.length,
      passed: scenario.ok,
      issues: [...scenario.issues],
    }],
  };
};

/** COM-8 programmatic probe — join-evidence repair when coordination directory is stale. */
export const runJoinerMembershipRepairProbe = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId?: string;
}>): DevLabJoinerMembershipProbeResult => {
  const profileId = params.profileId ?? getResolvedProfileId();
  const publicKeyHex = params.publicKeyHex.trim() as PublicKeyHex;
  if (!publicKeyHex) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_public_key",
      kernelAuthority: isWorkspaceKernelAuthority(),
      synthetic: false,
      groupsChecked: 0,
      groups: [],
    };
  }

  if (!isWorkspaceKernelAuthority()) {
    if (isDevLabEnabled()) {
      return runSyntheticJoinerMembershipRepairProbe();
    }
    return {
      ok: true,
      skipped: true,
      reason: "workspace_kernel_inactive",
      kernelAuthority: false,
      synthetic: false,
      groupsChecked: 0,
      groups: [],
    };
  }

  const persisted = loadWorkspaceGroupMetadataRecords(publicKeyHex, profileId);
  const groups = resolveManagedWorkspaceGroupList({
    publicKeyHex,
    profileId,
    persistedGroups: persisted,
  });

  const candidates = groups.filter((group) => (
    isStrictManagedWorkspaceRelay(group.relayUrl)
    && buildManagedWorkspaceRosterRepairContext({ group, publicKeyHex, profileId })
      .joinEvidenceMemberPubkeys.length >= 2
  ));

  if (candidates.length === 0) {
    return {
      ok: true,
      skipped: true,
      reason: "no_multi_member_join_evidence_groups",
      kernelAuthority: true,
      synthetic: false,
      groupsChecked: 0,
      groups: [],
    };
  }

  const groupResults = candidates.map((group) => probeGroup({
    group: enrichWorkspaceGroupConversation(group),
    publicKeyHex,
    profileId,
  }));
  const ok = groupResults.every((entry) => entry.passed);

  return {
    ok,
    skipped: false,
    reason: ok ? "joiner_membership_repair_ok" : "joiner_membership_repair_failed",
    kernelAuthority: true,
    synthetic: false,
    groupsChecked: groupResults.length,
    groups: groupResults,
  };
};
