"use client";

/**
 * Visual-only group community hook — relay membership ingest removed (Path B B1-2).
 *
 * Chat relay ingest: {@link useGroupThreadRelayIngest} + {@link ingestSealedCommunityRelayEvent}.
 * Outbound group send: canonical owner is {@link useChatActions} (Path B B3-1); this hook's sendMessage is a no-op.
 * Membership roster: coordination directory via {@link community-membership-truth}.
 */

import { useCallback, useMemo, useState } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityContentTimelineEntry } from "@dweb/core/community-projection-contracts";
import type { SemanticCommunityMemberEvent } from "@dweb/transport-contracts";
import type { CommunityGovernanceVote } from "@dweb/core/community-control-event-contracts";
import type { CommunityMode, GroupRole, GroupMembershipStatus, GroupMetadata, JoinRequestState } from "../types";
import type { JoinRequestBlockReason } from "../../messaging/types";
import {
  normalizeSealedCommunityRelayUrl as normalizeRelayUrl,
  toScopedRelayUrl,
  isValidScopedRelayUrl,
  isScopedRelayEvent,
  hasCommunityBindingTag,
  type SealedCommunityNostrPool,
} from "../services/sealed-community-relay-scope";
import {
  mergeGroupMessagesDescending,
  type SealedCommunityGroupMessageEvent,
} from "../services/sealed-community-message-merge";
import { publishRelayConfirmedCommunityLeave } from "../services/community-relay-confirmed-leave";

export { GROUP_MEMBERSHIP_SNAPSHOT_EVENT, COMMUNITY_KNOWN_PARTICIPANTS_OBSERVED_EVENT } from "@/app/features/profiles/services/profile-bus-dispatch";
export {
  normalizeSealedCommunityRelayUrl as normalizeRelayUrl,
  isValidScopedRelayUrl,
  toScopedRelayUrl,
  isScopedRelayEvent,
  hasCommunityBindingTag,
} from "../services/sealed-community-relay-scope";

export type GroupMessageEvent = SealedCommunityGroupMessageEvent;
export { mergeGroupMessagesDescending };

type Nip29GroupState = Readonly<{
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

type UseSealedCommunityParams = Readonly<{
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
  state: Nip29GroupState;
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

const createReadyState = (params: UseSealedCommunityParams): Nip29GroupState => ({
  status: "ready",
  joinRequestState: "none",
  membership: { status: "unknown", role: "member" },
  messages: [],
  joinRequests: [],
  admins: [],
  relayFeedback: {},
  kickVotes: {},
  expelledMembers: [],
  leftMembers: [],
  metadata: params.groupId.trim()
    ? { id: params.groupId, name: params.groupId, about: "", access: "open" as const }
    : undefined,
});

const noopAsync = async (): Promise<void> => undefined;

export const useSealedCommunity = (params: UseSealedCommunityParams): UseSealedCommunityResult => {
  const [state] = useState<Nip29GroupState>(() => createReadyState(params));
  const members = useMemo(
    () => (params.initialMembers ?? []).filter(Boolean) as PublicKeyHex[],
    [params.initialMembers],
  );

  const contentTimeline = useMemo<ReadonlyArray<CommunityContentTimelineEntry>>(() => [], []);

  const refresh = useCallback((): void => undefined, []);
  const clearLocalTerminalMembershipEvidence = useCallback((): void => undefined, []);
  const applyCoordinationSemanticMemberEvent = useCallback((): void => undefined, []);

  const leaveGroup = useCallback(async (): Promise<boolean> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex || !params.groupId.trim()) {
      return false;
    }
    if (params.enabled === false) {
      return false;
    }
    return publishRelayConfirmedCommunityLeave({
      pool: params.pool,
      groupId: params.groupId,
      relayUrl: params.relayUrl,
      communityId: params.communityId,
      communityMode: params.communityMode,
      myPublicKeyHex: params.myPublicKeyHex,
      myPrivateKeyHex: params.myPrivateKeyHex,
      initialMembers: params.initialMembers ?? members,
    });
  }, [
    members,
    params.communityId,
    params.communityMode,
    params.enabled,
    params.groupId,
    params.initialMembers,
    params.myPrivateKeyHex,
    params.myPublicKeyHex,
    params.pool,
    params.relayUrl,
  ]);

  return {
    state,
    contentTimeline,
    refresh,
    clearLocalTerminalMembershipEvidence,
    requestJoin: noopAsync,
    approveJoin: noopAsync,
    denyJoin: noopAsync,
    approveAllJoinRequests: noopAsync,
    denyAllJoinRequests: noopAsync,
    sendMessage: noopAsync,
    sendVoteKick: noopAsync,
    proposeDescriptorUpdate: noopAsync,
    proposeExpelMember: noopAsync,
    expelMemberDirect: noopAsync,
    castGovernanceVote: noopAsync,
    rotateRoomKey: noopAsync,
    updateMetadata: noopAsync,
    setGroupStatus: noopAsync,
    putUser: noopAsync,
    removeUser: noopAsync,
    promoteUser: noopAsync,
    demoteUser: noopAsync,
    leaveGroup,
    deleteMessage: noopAsync,
    members,
    admins: [],
    applyCoordinationSemanticMemberEvent,
  };
};
