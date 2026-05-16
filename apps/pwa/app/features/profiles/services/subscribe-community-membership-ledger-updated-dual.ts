import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { CommunityMembershipLedgerUpdatedEventDetail } from "@/app/features/groups/services/community-membership-ledger";

/**
 * Subscribe to membership ledger snapshot updates on the profile bus (Phase 1: legacy window removed).
 */
export function subscribeCommunityMembershipLedgerUpdatedDual(
    onDetail: (detail: CommunityMembershipLedgerUpdatedEventDetail) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("community-membership-ledger-updated", (ev) => {
            onDetail(ev.detail as CommunityMembershipLedgerUpdatedEventDetail);
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
