import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { loadCoordinationMembershipDirectory } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import { enrichWorkspaceGroupConversation } from "@/app/features/groups/services/community-workspace-r1-policy";
import { isStrictManagedWorkspaceRelay } from "@/app/features/groups/services/strict-managed-workspace";
import { buildManagedWorkspaceRosterRepairContext } from "@/app/features/groups/services/managed-workspace-roster-repair-context";
import { loadCommunityDmInviteLedger } from "@/app/features/groups/services/community-dm-invite-ledger";
import { requestFlowEvidenceStore } from "@/app/features/messaging/services/request-flow-evidence-store";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { loadWorkspaceGroupMetadataRecords } from "@/app/features/workspace-kernel/workspace-kernel-group-metadata-store";
import { resolveManagedWorkspaceGroupList } from "@/app/features/workspace-kernel/workspace-kernel-list-port";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { DEV_LAB_ACCOUNTS, type DevLabAccountId } from "./dev-lab-accounts";
import { isDevLabEnabled } from "./dev-lab-policy";

export type MembershipGraphLayerId = "layer0_social" | "layer1_invite" | "layer2_workspace";

export type DevLabMembershipGraphLayerProbe = Readonly<{
  layer: MembershipGraphLayerId;
  ok: boolean;
  skipped: boolean;
  reason: string;
  details: Readonly<Record<string, unknown>>;
}>;

export type DevLabMembershipGraphProbeResult = Readonly<{
  actorAccountId: DevLabAccountId | "unknown";
  actorPublicKeyHex: PublicKeyHex | "";
  peerPublicKeyHex: PublicKeyHex | "";
  layers: ReadonlyArray<DevLabMembershipGraphLayerProbe>;
  /** True when every layer is ok or explicitly skipped. */
  ok: boolean;
  /** First failing layer id, if any. */
  failingLayer: MembershipGraphLayerId | null;
  capturedAtUnixMs: number;
}>;

const normalizePubkey = (pubkey: string): string => pubkey.trim().toLowerCase();

const includesPubkey = (
  pubkeys: ReadonlyArray<string>,
  target: string,
): boolean => pubkeys.some((entry) => normalizePubkey(entry) === normalizePubkey(target));

const readLegacyAcceptedPeers = (ownerPublicKeyHex: PublicKeyHex): ReadonlyArray<PublicKeyHex> => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(`obscur.peer_trust.v1.${ownerPublicKeyHex}`);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as { acceptedPeers?: ReadonlyArray<string> };
    return (parsed.acceptedPeers ?? []).map((entry) => normalizePubkey(entry) as PublicKeyHex);
  } catch {
    return [];
  }
};

const resolveDevLabPeerPubkey = (peerPublicKeyHex?: string): PublicKeyHex | "" => {
  const trimmed = peerPublicKeyHex?.trim();
  if (trimmed) {
    return trimmed as PublicKeyHex;
  }
  return (DEV_LAB_ACCOUNTS.tester2.publicKeyHex ?? derivePublicKeyHex(DEV_LAB_ACCOUNTS.tester2.privateKeyHex!)) as PublicKeyHex;
};

const resolveDevLabActorAccountId = (
  actorPublicKeyHex: PublicKeyHex | "",
): DevLabAccountId | "unknown" => {
  const normalized = normalizePubkey(actorPublicKeyHex);
  const tester1 = normalizePubkey(derivePublicKeyHex(DEV_LAB_ACCOUNTS.tester1.privateKeyHex!));
  const tester2 = normalizePubkey(
    DEV_LAB_ACCOUNTS.tester2.publicKeyHex ?? derivePublicKeyHex(DEV_LAB_ACCOUNTS.tester2.privateKeyHex!),
  );
  if (normalized === tester1) {
    return "tester1";
  }
  if (normalized === tester2) {
    return "tester2";
  }
  return "unknown";
};

const probeLayer0SocialEdge = (params: Readonly<{
  actorPublicKeyHex: PublicKeyHex;
  peerPublicKeyHex: PublicKeyHex;
  profileId: string;
}>): DevLabMembershipGraphLayerProbe => {
  const evidence = requestFlowEvidenceStore.get(params.peerPublicKeyHex, params.profileId);
  const acceptedPeers = readLegacyAcceptedPeers(params.actorPublicKeyHex);
  const peerAccepted = includesPubkey(acceptedPeers, params.peerPublicKeyHex);
  const hasRequestEvidence = Boolean(
    evidence.requestEventId
    || evidence.receiptAckSeen
    || evidence.acceptSeen,
  );
  const ok = peerAccepted || evidence.acceptSeen || hasRequestEvidence;
  return {
    layer: "layer0_social",
    ok,
    skipped: false,
    reason: ok
      ? peerAccepted
        ? "peer_accepted"
        : evidence.acceptSeen
          ? "request_accept_seen"
          : "request_evidence_present"
      : "no_social_edge",
    details: {
      peerAccepted,
      acceptSeen: evidence.acceptSeen,
      receiptAckSeen: evidence.receiptAckSeen,
      requestEventId: evidence.requestEventId ?? null,
      lastEvidenceUnixMs: evidence.lastEvidenceUnixMs ?? null,
    },
  };
};

const probeLayer1InviteChannel = (params: Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  profileId: string;
}>): DevLabMembershipGraphLayerProbe => {
  const ledger = loadCommunityDmInviteLedger(params.profileId);
  const peerEntries = ledger.filter((entry) => (
    normalizePubkey(entry.peerPubkey) === normalizePubkey(params.peerPublicKeyHex)
  ));
  if (peerEntries.length === 0) {
    return {
      layer: "layer1_invite",
      ok: true,
      skipped: true,
      reason: "no_invite_ledger_entries",
      details: { ledgerCount: ledger.length, peerEntryCount: 0 },
    };
  }
  const statuses = peerEntries.map((entry) => entry.status);
  const hasOpenInvite = peerEntries.some((entry) => (
    entry.status === "pending" || entry.status === "accepted"
  ));
  return {
    layer: "layer1_invite",
    ok: hasOpenInvite,
    skipped: false,
    reason: hasOpenInvite ? "invite_ledger_present" : "invite_ledger_terminal_only",
    details: {
      peerEntryCount: peerEntries.length,
      statuses,
      groupIds: peerEntries.map((entry) => entry.groupId),
    },
  };
};

const probeLayer2WorkspaceMembership = (params: Readonly<{
  actorPublicKeyHex: PublicKeyHex;
  peerPublicKeyHex: PublicKeyHex;
  profileId: string;
}>): DevLabMembershipGraphLayerProbe => {
  if (!isWorkspaceKernelAuthority()) {
    return {
      layer: "layer2_workspace",
      ok: true,
      skipped: true,
      reason: "workspace_kernel_inactive",
      details: {},
    };
  }

  const persisted = loadWorkspaceGroupMetadataRecords(params.actorPublicKeyHex, params.profileId);
  const groups = resolveManagedWorkspaceGroupList({
    publicKeyHex: params.actorPublicKeyHex,
    profileId: params.profileId,
    persistedGroups: persisted,
  }).filter((group) => isStrictManagedWorkspaceRelay(group.relayUrl));

  if (groups.length === 0) {
    return {
      layer: "layer2_workspace",
      ok: true,
      skipped: true,
      reason: "no_managed_workspace_groups",
      details: { managedGroupCount: 0 },
    };
  }

  const groupSummaries = groups.map((group) => {
    const enriched = enrichWorkspaceGroupConversation(group);
    const repair = buildManagedWorkspaceRosterRepairContext({
      group: enriched,
      publicKeyHex: params.actorPublicKeyHex,
      profileId: params.profileId,
    });
    const communityId = repair.resolvedCommunityId ?? "";
    const directory = communityId
      ? loadCoordinationMembershipDirectory(communityId, params.profileId)
      : null;
    const active = directory?.activeMemberPubkeys ?? [];
    const actorInDirectory = includesPubkey(active, params.actorPublicKeyHex);
    const peerInDirectory = includesPubkey(active, params.peerPublicKeyHex);
    return {
      groupId: group.groupId,
      communityId,
      directoryActiveCount: active.length,
      actorInDirectory,
      peerInDirectory,
      joinEvidenceCount: repair.joinEvidenceMemberPubkeys.length,
    };
  });

  const multiMemberCandidates = groupSummaries.filter((entry) => entry.joinEvidenceCount >= 2);
  const targets = multiMemberCandidates.length > 0 ? multiMemberCandidates : groupSummaries;
  const failing = targets.find((entry) => (
    entry.joinEvidenceCount >= 2
      ? !entry.peerInDirectory || !entry.actorInDirectory
      : entry.directoryActiveCount > 0 && !entry.actorInDirectory
  ));

  if (!failing) {
    return {
      layer: "layer2_workspace",
      ok: true,
      skipped: multiMemberCandidates.length === 0,
      reason: multiMemberCandidates.length === 0
        ? "workspace_groups_no_multi_member_fixture"
        : "coordination_directory_lists_both_peers",
      details: { groups: groupSummaries },
    };
  }

  return {
    layer: "layer2_workspace",
    ok: false,
    skipped: false,
    reason: !failing.peerInDirectory
      ? "coordination_directory_missing_peer"
      : "coordination_directory_missing_actor",
    details: { groups: groupSummaries, failingGroupId: failing.groupId },
  };
};

/** COM-MEM-2 graph edge probes — Layer 0 social, Layer 1 invite DM, Layer 2 workspace directory. */
export const probeDevLabMembershipGraph = (params: Readonly<{
  actorPublicKeyHex: PublicKeyHex | string;
  peerPublicKeyHex?: string;
  profileId?: string;
}>): DevLabMembershipGraphProbeResult => {
  const capturedAtUnixMs = Date.now();
  const profileId = params.profileId ?? getResolvedProfileId();
  const actorPublicKeyHex = params.actorPublicKeyHex.trim() as PublicKeyHex;
  const peerPublicKeyHex = resolveDevLabPeerPubkey(params.peerPublicKeyHex);

  if (!isDevLabEnabled() || !actorPublicKeyHex || !peerPublicKeyHex) {
    return {
      actorAccountId: "unknown",
      actorPublicKeyHex: actorPublicKeyHex || "",
      peerPublicKeyHex: peerPublicKeyHex || "",
      layers: [],
      ok: true,
      failingLayer: null,
      capturedAtUnixMs,
    };
  }

  const layers: DevLabMembershipGraphLayerProbe[] = [
    probeLayer0SocialEdge({ actorPublicKeyHex, peerPublicKeyHex, profileId }),
    probeLayer1InviteChannel({ peerPublicKeyHex, profileId }),
    probeLayer2WorkspaceMembership({ actorPublicKeyHex, peerPublicKeyHex, profileId }),
  ];

  const failingLayer = layers.find((layer) => !layer.ok && !layer.skipped)?.layer ?? null;
  const ok = failingLayer === null;

  return {
    actorAccountId: resolveDevLabActorAccountId(actorPublicKeyHex),
    actorPublicKeyHex,
    peerPublicKeyHex,
    layers,
    ok,
    failingLayer,
    capturedAtUnixMs,
  };
};

export const formatMembershipGraphLayerMessage = (
  layer: DevLabMembershipGraphLayerProbe,
): string => {
  const label = layer.layer.replace("layer", "Layer ").replace("_", " ");
  if (layer.skipped) {
    return `${label} skipped (${layer.reason}).`;
  }
  return layer.ok
    ? `${label} ok (${layer.reason}).`
    : `${label} FAIL (${layer.reason}).`;
};
