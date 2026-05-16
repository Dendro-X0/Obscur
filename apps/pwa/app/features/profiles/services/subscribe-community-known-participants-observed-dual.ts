import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { CommunityKnownParticipantsObservedDispatchDetail } from "./profile-bus-dispatch";

/**
 * Subscribe to known-participants observed on the profile bus (Phase 1: legacy window removed).
 */
export function subscribeCommunityKnownParticipantsObservedDual(
    onDetail: (detail: CommunityKnownParticipantsObservedDispatchDetail) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("community-known-participants-observed", (ev) => {
            const d = ev.detail as CommunityKnownParticipantsObservedDispatchDetail;
            if (d && typeof d === "object") {
                onDetail(d);
            }
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
