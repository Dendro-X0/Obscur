import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PersistedChatState } from "@/app/features/messaging/types";

/** Dedupe message `pubkey` values for roster author-evidence input (non-owner surfaces). */
export const resolveAuthorEvidencePubkeysFromCommunityMessages = (
  messages: ReadonlyArray<Readonly<{ pubkey?: string | null }>>,
): ReadonlyArray<PublicKeyHex> => (
  Array.from(new Set(
    messages
      .map((message) => message.pubkey?.trim() ?? "")
      .filter((pubkey) => pubkey.length > 0),
  )) as ReadonlyArray<PublicKeyHex>
);

/** Persisted chat-state authors for a community conversation (group-provider / group-home hydrate). */
export const collectGroupMessageAuthorPubkeys = (params: Readonly<{
  chatState: PersistedChatState | null | undefined;
  conversationId: string;
}>): ReadonlyArray<PublicKeyHex> => {
  const messages = params.chatState?.groupMessages?.[params.conversationId] ?? [];
  return resolveAuthorEvidencePubkeysFromCommunityMessages(messages);
};
