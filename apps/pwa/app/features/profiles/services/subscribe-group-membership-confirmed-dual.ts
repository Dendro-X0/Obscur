import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { GroupMembershipConfirmedDispatchDetail } from "./profile-bus-dispatch";

/**
 * Subscribe to membership-confirmed on the profile bus (Phase 1: legacy window removed).
 */
export function subscribeGroupMembershipConfirmedDual(
    onDetail: (detail: GroupMembershipConfirmedDispatchDetail) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("group-membership-confirmed", (ev) => {
            const d = ev.detail as GroupMembershipConfirmedDispatchDetail;
            if (d && typeof d === "object") {
                onDetail(d);
            }
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
