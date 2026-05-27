/**
 * @deprecated Use {@link commitOutboundCommunityDmInvite} from community-dm-invite-pipeline.
 * Thin adapter kept for existing import sites during migration.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import {
  commitOutboundCommunityDmInvite,
  parseInvitePayloadFromMessageContent,
} from "./community-dm-invite-pipeline";

export type CommitOutgoingCommunityInviteDmParams = Readonly<{
  inviteMessage: Message;
  accountPublicKeyHex: PublicKeyHex;
  profileId?: string;
}>;

export const commitOutgoingCommunityInviteDm = async (
  params: CommitOutgoingCommunityInviteDmParams,
): Promise<Message> => {
  const invitePayload = parseInvitePayloadFromMessageContent(params.inviteMessage.content);
  if (!invitePayload) {
    throw new Error("commitOutgoingCommunityInviteDm: message is not a community invite");
  }
  return commitOutboundCommunityDmInvite({
    inviteId: invitePayload.inviteId,
    invitePayload,
    dmMessage: params.inviteMessage,
    accountPublicKeyHex: params.accountPublicKeyHex,
    profileId: params.profileId,
  });
};
