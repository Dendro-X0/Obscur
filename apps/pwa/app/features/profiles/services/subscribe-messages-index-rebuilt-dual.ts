import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { MessagesIndexRebuiltEventDetail } from "@/app/features/messaging/services/message-persistence-service";

/**
 * Subscribe to messages-index rebuilt on the profile bus (Phase 1: legacy window removed).
 */
export function subscribeMessagesIndexRebuiltDual(
    onDetail: (detail: MessagesIndexRebuiltEventDetail) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("messages-index-rebuilt", (ev) => {
            onDetail(ev.detail as MessagesIndexRebuiltEventDetail);
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
