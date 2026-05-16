import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";

/**
 * Subscribe to group-remove on the profile bus (Phase 1: legacy window removed).
 */
export function subscribeGroupRemoveDual(
    onConversationId: (conversationId: string) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("group-removed", (ev) => {
            const id = ev.conversationId.trim();
            if (id.length > 0) {
                onConversationId(id);
            }
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
