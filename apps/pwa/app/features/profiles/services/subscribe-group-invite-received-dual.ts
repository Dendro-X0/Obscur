import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";

/**
 * Subscribe to group-invite materialization on the profile bus (Phase 1: legacy window removed).
 */
export function subscribeGroupInviteReceivedDual(
    onInvite: (invite: unknown) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("group-invite-received", (ev) => {
            if (ev.invite != null && typeof ev.invite === "object") {
                onInvite(ev.invite);
            }
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
