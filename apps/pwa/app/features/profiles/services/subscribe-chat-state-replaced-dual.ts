import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { ChatStateReplacedEventDetail } from "@/app/features/messaging/services/chat-state-store-types";

export type ChatStateReplacedDetailPartial = Partial<ChatStateReplacedEventDetail>;

/**
 * Subscribe to chat-state-replaced on the profile bus (Phase 1: legacy window path removed).
 */
export function subscribeChatStateReplacedDual(
    onDetail: (detail: ChatStateReplacedDetailPartial | undefined) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("chat-state-replaced", (ev) => {
            onDetail({ publicKeyHex: ev.publicKeyHex, profileId: ev.profileId });
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
