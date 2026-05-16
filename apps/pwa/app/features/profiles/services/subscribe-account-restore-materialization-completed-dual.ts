import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { AccountRestoreMaterializationEventDetail } from "@/app/features/account-sync/services/restore-materialization-events";

/**
 * Subscribe to account-restore materialization completed on the profile bus (Phase 1: legacy window removed).
 */
export function subscribeAccountRestoreMaterializationCompletedDual(
    onDetail: (detail: AccountRestoreMaterializationEventDetail) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("account-restore-materialization-completed", (ev) => {
            const d = ev.detail as AccountRestoreMaterializationEventDetail;
            if (d && typeof d.publicKeyHex === "string" && typeof d.profileId === "string") {
                onDetail(d);
            }
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
