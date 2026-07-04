/**
 * Sealed community hook contracts — types and relay-scope helpers.
 * Runtime hook lives in legacy until workspace-kernel owns community ingress.
 */
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityContentTimelineEntry } from "@dweb/core/community-projection-contracts";
import type { SemanticCommunityMemberEvent } from "@dweb/transport-contracts";
import type { CommunityGovernanceVote } from "@dweb/core/community-control-event-contracts";

import type { JoinRequestBlockReason } from "../../messaging/types";
import type { CommunityMode, GroupMetadata, GroupMembershipStatus, GroupRole, JoinRequestState } from "../types";
import {
  type SealedCommunityNostrPool,
  hasCommunityBindingTag,
  isScopedRelayEvent,
  isValidScopedRelayUrl,
  normalizeSealedCommunityRelayUrl,
  toScopedRelayUrl,
} from "../services/sealed-community-relay-scope";
import {
  mergeGroupMessagesDescending,
  type SealedCommunityGroupMessageEvent,
} from "../services/sealed-community-message-merge";

export {
  COMMUNITY_KNOWN_PARTICIPANTS_OBSERVED_EVENT,
  GROUP_MEMBERSHIP_SNAPSHOT_EVENT,
} from "@/app/features/profiles/services/profile-bus-dispatch";

export {
  hasCommunityBindingTag,
  isScopedRelayEvent,
  isValidScopedRelayUrl,
  normalizeSealedCommunityRelayUrl as normalizeRelayUrl,
  toScopedRelayUrl,
};

export type GroupMessageEvent = SealedCommunityGroupMessageEvent;

export { mergeGroupMessagesDescending };

export type UseSealedCommunityParams = Readonly<{
  pool: SealedCommunityNostrPool;
  relayUrl: string;
  communityRelayBroadcastUrls?: ReadonlyArray<string>;
  groupId: string;
  communityId?: string;
  communityMode?: CommunityMode;
  myPublicKeyHex: PublicKeyHex | null;
  myPrivateKeyHex: PrivateKeyHex | null;
  enabled?: boolean;
  initialMembers?: ReadonlyArray<PublicKeyHex>;
}>;

export type UseSealedCommunityResult = Readonly<{
  state: Readonly<{
    status: "idle" | "loading" | "ready" | "error";
    error?: string;
    joinRequestState: JoinRequestState;
    joinRequestBlockReason?: JoinRequestBlockReason;
    metadata?: GroupMetadata;
    membership: Readonly<{ status: GroupMembershipStatus; role: GroupRole }>;
    messages: ReadonlyArray<GroupMessageEvent>;
    joinRequests: ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; createdAt: number; content: string }>>;
    admins: ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; roles: ReadonlyArray<string> }>>;
    relayFeedback: Readonly<{
      lastNotice?: string;
      rejectionStats?: Readonly<{ relayScopeMismatch?: number }>;
    }>;
    kickVotes: Readonly<Record<PublicKeyHex, string[]>>;
    expelledMembers: ReadonlyArray<PublicKeyHex>;
    leftMembers: ReadonlyArray<PublicKeyHex>;
    disbandedAt?: number;
  }>;
  contentTimeline: ReadonlyArray<CommunityContentTimelineEntry>;
  refresh: () => void;
  clearLocalTerminalMembershipEvidence: () => void;
  requestJoin: () => Promise<void>;
  approveJoin: (params: Readonly<{ publicKeyHex: PublicKeyHex; role?: GroupRole }>) => Promise<void>;
  denyJoin: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => Promise<void>;
  approveAllJoinRequests: () => Promise<void>;
  denyAllJoinRequests: () => Promise<void>;
  sendMessage: (params: Readonly<{ content: string }>) => Promise<void>;
  sendVoteKick: (targetPubkey: string, reason?: string) => Promise<void>;
  proposeDescriptorUpdate: (params: Readonly<GroupMetadata>) => Promise<void>;
  proposeExpelMember: (params: Readonly<{ targetPublicKeyHex: PublicKeyHex; reason?: string }>) => Promise<void>;
  expelMemberDirect: (params: Readonly<{ targetPublicKeyHex: PublicKeyHex; reason?: string }>) => Promise<void>;
  castGovernanceVote: (params: Readonly<{ proposalId: string; vote: CommunityGovernanceVote }>) => Promise<void>;
  rotateRoomKey: () => Promise<void>;
  updateMetadata: (
    params: Readonly<GroupMetadata>,
    options?: Readonly<{ governanceProposalId?: string }>,
  ) => Promise<void>;
  setGroupStatus: (params: Readonly<{ access: "open" | "invite-only" | "discoverable" }>) => Promise<void>;
  putUser: (params: Readonly<{ publicKeyHex: PublicKeyHex; role?: GroupRole }>) => Promise<void>;
  removeUser: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => Promise<void>;
  promoteUser: (params: Readonly<{ publicKeyHex: PublicKeyHex; role: "owner" | "moderator" }>) => Promise<void>;
  demoteUser: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => Promise<void>;
  leaveGroup: () => Promise<boolean>;
  deleteMessage: (params: Readonly<{ eventId: string; reason?: string }>) => Promise<void>;
  members: ReadonlyArray<PublicKeyHex>;
  admins: ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; roles: ReadonlyArray<string> }>>;
  applyCoordinationSemanticMemberEvent: (semantic: SemanticCommunityMemberEvent) => void;
}>;
