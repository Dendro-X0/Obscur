import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";

/**
 * Subscribe to voice overlay actions on the profile bus (Phase 1: legacy window removed).
 */
export function subscribeVoiceCallOverlayActionDual(
  onPayload: (payload: unknown) => void,
  optionalProfileBus: ProfileMessageBus | null,
): () => void {
  const unsubBus =
    optionalProfileBus?.subscribeTo("voice-call-overlay-action", (ev) => {
      onPayload(ev.detail);
    }) ?? null;

  return (): void => {
    unsubBus?.();
  };
}
