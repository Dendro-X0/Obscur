import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "../types/community-mode";
import { isRegisteredCommunityBot } from "./community-bot-policy";

export type CommunityChatIngestDecision = Readonly<{
  accept: boolean;
  reasonCode: "accepted" | "unlisted_author_managed_workspace";
}>;

/**
 * When a managed workspace registers `botPubkeys`, only listed bots, stewards,
 * and active members may contribute chat rows (B1 outbound contract).
 */
export const evaluateCommunityChatMessageIngest = (params: Readonly<{
  communityMode?: CommunityMode;
  authorPublicKeyHex: PublicKeyHex;
  botPubkeys: ReadonlyArray<PublicKeyHex>;
  stewardPubkeys: ReadonlyArray<PublicKeyHex>;
  activeMemberPubkeys: ReadonlyArray<PublicKeyHex>;
}>): CommunityChatIngestDecision => {
  if (params.communityMode !== "managed_workspace") {
    return { accept: true, reasonCode: "accepted" };
  }

  if (params.botPubkeys.length === 0) {
    return { accept: true, reasonCode: "accepted" };
  }

  const author = params.authorPublicKeyHex;
  if (params.activeMemberPubkeys.includes(author)) {
    return { accept: true, reasonCode: "accepted" };
  }
  if (params.stewardPubkeys.includes(author)) {
    return { accept: true, reasonCode: "accepted" };
  }
  if (isRegisteredCommunityBot({ botPubkeys: params.botPubkeys, authorPublicKeyHex: author })) {
    return { accept: true, reasonCode: "accepted" };
  }

  return { accept: false, reasonCode: "unlisted_author_managed_workspace" };
};
