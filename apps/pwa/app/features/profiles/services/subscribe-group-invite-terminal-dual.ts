import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { GroupInviteResponseTerminalDetail } from "./profile-bus-dispatch";

export function subscribeGroupInviteTerminalDual(
    onDetail: (detail: GroupInviteResponseTerminalDetail) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("group-invite-terminal", (ev) => {
            onDetail({
                groupId: ev.groupId,
                memberPubkey: ev.memberPubkey,
                relayUrl: ev.relayUrl,
                communityId: ev.communityId,
                recipientPublicKeyHex: ev.recipientPublicKeyHex,
                responseStatus: ev.responseStatus,
            });
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
