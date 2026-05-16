import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { PeerInteractionUpdatedEventDetail } from "@/app/features/messaging/services/peer-interaction-store";

/**
 * Subscribe to peer last-active store updates on the profile bus (Phase 1: legacy window removed).
 */
export function subscribePeerInteractionUpdatedDual(
    onDetail: (detail: PeerInteractionUpdatedEventDetail) => void,
    optionalProfileBus: ProfileMessageBus | null,
): () => void {
    const unsubBus =
        optionalProfileBus?.subscribeTo("peer-interaction-updated", (ev) => {
            const d = ev.detail as PeerInteractionUpdatedEventDetail;
            if (d && typeof d === "object" && typeof d.publicKeyHex === "string") {
                const pid = (d as { profileId?: unknown }).profileId;
                onDetail({
                    publicKeyHex: d.publicKeyHex,
                    ...(typeof pid === "string" ? { profileId: pid } : {}),
                });
            }
        }) ?? null;

    return (): void => {
        unsubBus?.();
    };
}
