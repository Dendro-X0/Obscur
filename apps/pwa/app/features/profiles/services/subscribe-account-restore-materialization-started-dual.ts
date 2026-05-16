import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { AccountRestoreMaterializationEventDetail } from "@/app/features/account-sync/services/restore-materialization-events";

/**
 * Subscribe to account-restore materialization started on the profile bus (Phase 1: legacy window removed).
 */
export function subscribeAccountRestoreMaterializationStartedDual(
    onDetail: (detail: AccountRestoreMaterializationEventDetail) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("account-restore-materialization-started", (ev) => {
            const d = ev.detail as AccountRestoreMaterializationEventDetail;
            if (d && typeof d.publicKeyHex === "string" && typeof d.profileId === "string") {
                onDetail(d);
            }
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
