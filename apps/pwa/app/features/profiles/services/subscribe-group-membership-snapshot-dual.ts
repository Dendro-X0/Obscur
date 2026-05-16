import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { GroupMembershipSnapshotDispatchDetail } from "./profile-bus-dispatch";

/**
 * Subscribe to membership snapshot on the profile bus (Phase 1: legacy window removed).
 */
export function subscribeGroupMembershipSnapshotDual(
    onDetail: (detail: GroupMembershipSnapshotDispatchDetail) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("group-membership-snapshot", (ev) => {
            const d = ev.detail as GroupMembershipSnapshotDispatchDetail;
            if (d && typeof d === "object") {
                onDetail(d);
            }
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
