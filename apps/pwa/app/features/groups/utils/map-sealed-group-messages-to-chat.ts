import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import type { SealedCommunityGroupMessageEvent } from "../services/sealed-community-message-merge";

/** Map sealed community rows to ChatView `Message` rows (newest-first in state → ascending for UI). */
export const mapSealedGroupMessagesToChatMessages = (params: Readonly<{
  conversationId: string;
  messages: ReadonlyArray<SealedCommunityGroupMessageEvent>;
  myPublicKeyHex: string | null;
}>): ReadonlyArray<Message> => {
  const myKey = (params.myPublicKeyHex ?? "").toLowerCase();
  return [...params.messages]
    .sort((left, right) => left.created_at - right.created_at)
    .map((row) => {
      const author = row.pubkey as PublicKeyHex;
      return {
        id: row.id,
        kind: "user",
        content: row.content,
        timestamp: new Date(row.created_at * 1000),
        isOutgoing: myKey.length > 0 && author.toLowerCase() === myKey,
        status: "delivered",
        senderPubkey: author,
        conversationId: params.conversationId,
      } satisfies Message;
    });
};
