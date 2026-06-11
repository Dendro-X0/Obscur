import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import type { CommunityMode } from "../types";
import { resolveCommunityInviteMemberBlocklist } from "./community-invite-eligibility-read-model";
import { resolveCommunityParticipantDisplayPubkeys } from "./community-participant-display-read-model";
import type { CoordinationMembershipMaterialization } from "./community-coordination-membership-materializer";
import {
  enrichWorkspaceGroupConversation,
  resolveEffectiveCommunityMode,
  shouldUseCoordinationMembershipAuthority,
} from "./community-workspace-r1-policy";
import { usesCoordinationMembershipDirectory } from "./community-workspace-transport-policy";

export const JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_A = "aa".repeat(32) as PublicKeyHex;
export const JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_B = "bb".repeat(32) as PublicKeyHex;
export const JOINER_MEMBERSHIP_REPAIR_SCENARIO_RELAY = "ws://localhost:7000";

export const JOINER_MEMBERSHIP_REPAIR_LEGACY_GROUP: GroupConversation = {
  kind: "group",
  id: "community:newtest-2",
  groupId: "newtest-2",
  relayUrl: JOINER_MEMBERSHIP_REPAIR_SCENARIO_RELAY,
  displayName: "NewTest 2",
  memberPubkeys: [JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_A, JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_B],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
  access: "open",
  memberCount: 2,
  adminPubkeys: [],
};

export type JoinerMembershipRepairScenarioResult = Readonly<{
  ok: boolean;
  issues: ReadonlyArray<string>;
  effectiveCommunityMode: CommunityMode | undefined;
  displayPubkeys: ReadonlyArray<PublicKeyHex>;
  blocklistPubkeys: ReadonlyArray<PublicKeyHex>;
}>;

const STALE_DIRECTORY: CoordinationMembershipMaterialization = {
  activeMemberPubkeys: [JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_A],
  leftMemberPubkeys: [],
  expelledMemberPubkeys: [],
  headSeq: 2,
};

const normalizePubkey = (pubkey: string): string => pubkey.trim().toLowerCase();

const evaluateReadModels = (params: Readonly<{
  communityMode: CommunityMode | undefined;
  relayUrl: string;
  joinEvidence: ReadonlyArray<PublicKeyHex>;
}>): Pick<JoinerMembershipRepairScenarioResult, "displayPubkeys" | "blocklistPubkeys" | "issues"> => {
  const issues: string[] = [];
  const displayPubkeys = resolveCommunityParticipantDisplayPubkeys({
    communityMode: params.communityMode,
    relayUrl: params.relayUrl,
    coordinationDirectory: STALE_DIRECTORY,
    monotonicDisplayPubkeys: [JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_A],
    joinEvidenceMemberPubkeys: params.joinEvidence,
    localMemberPubkey: JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_A,
  });
  const blocklistPubkeys = resolveCommunityInviteMemberBlocklist({
    communityMode: params.communityMode,
    relayUrl: params.relayUrl,
    coordinationDirectory: STALE_DIRECTORY,
    hybridActiveMemberPubkeys: [JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_A],
    joinEvidenceMemberPubkeys: params.joinEvidence,
    leftMemberPubkeys: [],
    expelledMemberPubkeys: [],
  });

  for (const pubkey of params.joinEvidence) {
    if (!displayPubkeys.some((entry) => normalizePubkey(entry) === normalizePubkey(pubkey))) {
      issues.push(`display_missing_${normalizePubkey(pubkey).slice(0, 8)}`);
    }
    if (!blocklistPubkeys.some((entry) => normalizePubkey(entry) === normalizePubkey(pubkey))) {
      issues.push(`invite_blocklist_missing_${normalizePubkey(pubkey).slice(0, 8)}`);
    }
  }

  return { displayPubkeys, blocklistPubkeys, issues };
};

/** COM-8 read-model repair with explicit managed workspace mode (dev-lab browser path). */
export const evaluateJoinerMembershipRepairReadModels = (): JoinerMembershipRepairScenarioResult => {
  const relayUrl = JOINER_MEMBERSHIP_REPAIR_SCENARIO_RELAY;
  const joinEvidence = JOINER_MEMBERSHIP_REPAIR_LEGACY_GROUP.memberPubkeys ?? [];
  const readModels = evaluateReadModels({
    communityMode: "managed_workspace",
    relayUrl,
    joinEvidence,
  });
  return {
    ok: readModels.issues.length === 0,
    issues: readModels.issues,
    effectiveCommunityMode: "managed_workspace",
    displayPubkeys: readModels.displayPubkeys,
    blocklistPubkeys: readModels.blocklistPubkeys,
  };
};

/** Full COM-8 scenario — mode inference + stale-directory read-model repair. */
export const evaluateJoinerMembershipRepairScenario = (): JoinerMembershipRepairScenarioResult => {
  const relayUrl = JOINER_MEMBERSHIP_REPAIR_SCENARIO_RELAY;
  const enriched = enrichWorkspaceGroupConversation(JOINER_MEMBERSHIP_REPAIR_LEGACY_GROUP);
  const effectiveCommunityMode = resolveEffectiveCommunityMode(enriched.communityMode, relayUrl);
  const joinEvidence = enriched.memberPubkeys ?? [];
  const readModels = evaluateReadModels({
    communityMode: effectiveCommunityMode,
    relayUrl,
    joinEvidence,
  });
  const issues = [...readModels.issues];

  if (effectiveCommunityMode !== "managed_workspace") {
    issues.push("managed_workspace_not_inferred");
  }
  if (!shouldUseCoordinationMembershipAuthority(enriched.communityMode, relayUrl)) {
    issues.push("coordination_authority_inactive");
  }
  if (!usesCoordinationMembershipDirectory(enriched.communityMode, relayUrl)) {
    issues.push("coordination_directory_inactive");
  }

  return {
    ok: issues.length === 0,
    issues,
    effectiveCommunityMode,
    displayPubkeys: readModels.displayPubkeys,
    blocklistPubkeys: readModels.blocklistPubkeys,
  };
};
