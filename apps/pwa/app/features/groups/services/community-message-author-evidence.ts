import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PersistedChatState } from "@/app/features/messaging/types";
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";

export const collectGroupMessageAuthorPubkeys = (params: Readonly<{
  chatState: PersistedChatState | null | undefined;
  conversationId: string;
}>): ReadonlyArray<PublicKeyHex> => (
  getResolvedClientGateway().communityRoster.resolveAuthorEvidencePubkeysFromMessages(
    params.chatState?.groupMessages?.[params.conversationId] ?? [],
  )
);
