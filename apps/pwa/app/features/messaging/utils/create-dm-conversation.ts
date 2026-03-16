import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { DmConversation } from "@/app/features/messaging/types";
import { toDmConversationId } from "./dm-conversation-id";

export const createDmConversation = (params: Readonly<{
  myPublicKeyHex: string;
  peerPublicKeyHex: PublicKeyHex;
  displayName?: string;
}>): DmConversation | null => {
  const id = toDmConversationId({
    myPublicKeyHex: params.myPublicKeyHex,
    peerPublicKeyHex: params.peerPublicKeyHex,
  });
  if (!id) {
    return null;
  }

  return {
    kind: "dm",
    id,
    pubkey: params.peerPublicKeyHex,
    displayName: params.displayName || params.peerPublicKeyHex.slice(0, 8),
    lastMessage: "",
    unreadCount: 0,
    lastMessageTime: new Date(),
  };
};
