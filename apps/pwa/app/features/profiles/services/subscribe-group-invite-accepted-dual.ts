import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { GroupInviteResponseAcceptedDetail } from "./profile-bus-dispatch";

/**
 * Subscribe to invite-accepted on the profile bus (Phase 1: legacy window removed).
 */
export function subscribeGroupInviteAcceptedDual(
    onDetail: (detail: GroupInviteResponseAcceptedDetail) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("group-invite-accepted", (ev) => {
            onDetail({
                groupId: ev.groupId,
                memberPubkey: ev.memberPubkey,
                relayUrl: ev.relayUrl,
                communityId: ev.communityId,
                recipientPublicKeyHex: ev.recipientPublicKeyHex,
            });
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
