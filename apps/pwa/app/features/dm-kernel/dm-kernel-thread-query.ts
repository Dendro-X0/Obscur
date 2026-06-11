import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { toDmConversationId } from "@/app/features/messaging/utils/dm-conversation-id";
import { buildDmSiblingConversationIds, inferPeerFromConversationId } from "@/app/features/messaging/utils/dm-conversation-sibling-ids";

export const resolveDmKernelStorageConversationId = (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: string;
}>): string => {
  const normalizedMy = normalizePublicKeyHex(params.myPublicKeyHex) ?? params.myPublicKeyHex;
  const peerPubkey = inferPeerFromConversationId({
    conversationId: params.conversationId,
    myPublicKeyHex: normalizedMy as PublicKeyHex,
  });
  if (!peerPubkey) {
    return params.conversationId.trim();
  }
  return toDmConversationId({
    myPublicKeyHex: normalizedMy,
    peerPublicKeyHex: peerPubkey,
  }) ?? params.conversationId.trim();
};

export const resolveDmKernelThreadQueryConversationIds = (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: string;
}>): ReadonlyArray<string> => {
  const normalizedMy = normalizePublicKeyHex(params.myPublicKeyHex) ?? params.myPublicKeyHex;
  return buildDmSiblingConversationIds({
    conversationId: params.conversationId,
    myPublicKeyHex: normalizedMy as PublicKeyHex,
  });
};
