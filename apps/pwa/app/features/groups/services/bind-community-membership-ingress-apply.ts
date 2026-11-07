import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { GroupConversation } from "@/app/features/messaging/types";
import { subscribeCommunityMembershipIngress } from "@/app/features/profiles/services/subscribe-community-membership-ingress";
import { applyCommunityMembershipIngress } from "./apply-community-membership-ingress";
import {
  persistTerminalPeerLeftEvidence,
  removePubkeyFromMemberList,
} from "./community-invite-terminal-membership";
import type { CommunityMembershipIngressDetail } from "./community-membership-ingress-contract";

export type BindCommunityMembershipIngressApplyParams = Readonly<{
  profileBus: ProfileMessageBus | null;
  localPublicKeyHex: PublicKeyHex | null;
  resolveGroupByCommunityId: (communityId: string) => GroupConversation | undefined;
  updateGroupMembers: (params: Readonly<{
    group: GroupConversation;
    memberPubkeys: ReadonlyArray<PublicKeyHex>;
  }>) => void;
  applyLocalJoinFromRelay: (group: GroupConversation) => void;
  applyLocalLeaveFromRelay: (group: GroupConversation) => void;
  profileId?: string;
}>;

const mergeMemberPubkeys = (
  existing: ReadonlyArray<PublicKeyHex | string>,
  incoming: ReadonlyArray<PublicKeyHex>,
): ReadonlyArray<PublicKeyHex> => {
  const seen = new Set<string>();
  const out: PublicKeyHex[] = [];
  for (const pubkey of [...existing, ...incoming]) {
    const normalized = pubkey.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized as PublicKeyHex);
  }
  return out;
};

/**
 * Wire profile-bus membership ingress → roster widen / sticky peer leave / local join-leave.
 * Mount once from GroupProvider (Slice 2 leave peer visibility).
 */
export const bindCommunityMembershipIngressApply = (
  params: BindCommunityMembershipIngressApplyParams,
): (() => void) => {
  const onDetail = (detail: CommunityMembershipIngressDetail): void => {
    applyCommunityMembershipIngress({
      detail,
      localPublicKeyHex: params.localPublicKeyHex,
      resolveGroup: params.resolveGroupByCommunityId,
      widenRoster: ({ group, memberPubkeys }) => {
        params.updateGroupMembers({
          group,
          memberPubkeys: mergeMemberPubkeys(group.memberPubkeys ?? [], memberPubkeys),
        });
      },
      markMembersLeft: ({ group, memberPubkeys }) => {
        persistTerminalPeerLeftEvidence({
          groupId: group.groupId,
          relayUrl: group.relayUrl,
          peerPublicKeyHexes: memberPubkeys,
          reason: "left",
          profileId: params.profileId,
        });
        let nextMembers = group.memberPubkeys ?? [];
        for (const peer of memberPubkeys) {
          nextMembers = removePubkeyFromMemberList(nextMembers, peer) as ReadonlyArray<PublicKeyHex>;
        }
        params.updateGroupMembers({ group, memberPubkeys: nextMembers });
      },
      applyLocalJoinFromRelay: params.applyLocalJoinFromRelay,
      applyLocalLeaveFromRelay: params.applyLocalLeaveFromRelay,
    });
  };

  return subscribeCommunityMembershipIngress(onDetail, params.profileBus);
};
