import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";

/**
 * Subscribe to per-conversation notification preference updates on the profile bus (Phase 1: legacy window removed).
 */
export function subscribeNotificationTargetPreferenceChangedDual(
    listener: () => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("notification-target-preference-changed", listener) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
