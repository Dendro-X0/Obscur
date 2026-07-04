"use client";

/**
 * Visual-only group community hook — relay membership ingest removed (Path B B1-2).
 *
 * Chat relay ingest: useGroupThreadRelayIngest + ingestSealedCommunityRelayEvent.
 * Outbound group send: canonical owner is useChatActions (Path B B3-1); sendMessage is a no-op.
 * Membership roster: coordination directory via community-membership-truth.
 */

import { useCallback, useMemo, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupMetadata, GroupMembershipStatus, GroupRole, JoinRequestState } from "@/app/features/groups/types";
import type { JoinRequestBlockReason } from "@/app/features/messaging/types";
import { publishRelayConfirmedCommunityLeave } from "@/app/features/groups/services/community-relay-confirmed-leave";
import type {
  GroupMessageEvent,
  UseSealedCommunityParams,
  UseSealedCommunityResult,
} from "@/app/features/groups/hooks/use-sealed-community-types";

export type {
  GroupMessageEvent,
  UseSealedCommunityParams,
  UseSealedCommunityResult,
} from "@/app/features/groups/hooks/use-sealed-community-types";

export {
  COMMUNITY_KNOWN_PARTICIPANTS_OBSERVED_EVENT,
  GROUP_MEMBERSHIP_SNAPSHOT_EVENT,
  hasCommunityBindingTag,
  isScopedRelayEvent,
  isValidScopedRelayUrl,
  mergeGroupMessagesDescending,
  normalizeRelayUrl,
  toScopedRelayUrl,
} from "@/app/features/groups/hooks/use-sealed-community-types";

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

export const useLegacySealedCommunity = (params: UseSealedCommunityParams): UseSealedCommunityResult => {
  const [state] = useState<Nip29GroupState>(() => createReadyState(params));
  const members = useMemo(
    () => (params.initialMembers ?? []).filter(Boolean) as PublicKeyHex[],
    [params.initialMembers],
  );

  const contentTimeline = useMemo(() => [], []);

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

/** @deprecated Use useLegacySealedCommunity */
export const useSealedCommunity = useLegacySealedCommunity;
