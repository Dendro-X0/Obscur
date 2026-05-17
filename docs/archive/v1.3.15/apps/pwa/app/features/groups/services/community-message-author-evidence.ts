import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PersistedChatState } from "@/app/features/messaging/types";

export const collectGroupMessageAuthorPubkeys = (params: Readonly<{
  chatState: PersistedChatState | null | undefined;
  conversationId: string;
}>): ReadonlyArray<PublicKeyHex> => {
  const messages = params.chatState?.groupMessages?.[params.conversationId] ?? [];
  return Array.from(new Set(
    messages
      .map((message) => message.pubkey?.trim() ?? "")
      .filter((pubkey) => pubkey.length > 0)
  )) as ReadonlyArray<PublicKeyHex>;
};
