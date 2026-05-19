import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { GroupDescriptorUpdatedDispatchDetail } from "./profile-bus-dispatch";

export function subscribeGroupDescriptorUpdatedDual(
    onDetail: (detail: GroupDescriptorUpdatedDispatchDetail) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("group-descriptor-updated", (ev) => {
            const detail = ev.detail as GroupDescriptorUpdatedDispatchDetail;
            if (detail && typeof detail === "object" && typeof detail.groupId === "string") {
                onDetail(detail);
            }
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
