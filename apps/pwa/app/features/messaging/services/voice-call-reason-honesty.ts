/**
 * PB1-C / M1-A: map live call reason codes to operator-visible honesty copy.
 * Conference remains post-v2 (M2–M3). Video call *type* may negotiate (M1-A);
 * live AV media is M1-B / M1-L3.
 */

export type VoiceCallLiveReasonCode =
  | "left_by_user"
  | "remote_left"
  | "network_interrupted"
  | "session_closed";

/** Wire + UI call type after capability negotiation. */
export type SupportedCallType = "voice" | "video";

/** Requested call type on invite / dial (av ≡ video for negotiation). */
export type RequestedCallType = "voice" | "video" | "av";

export const resolveVoiceCallReasonHonestyKey = (
  reasonCode: VoiceCallLiveReasonCode | null | undefined,
): string | null => {
  switch (reasonCode) {
    case "network_interrupted":
      return "messaging.voiceCallReasonNetworkInterrupted";
    case "session_closed":
      return "messaging.voiceCallReasonSessionClosed";
    case "remote_left":
      return "messaging.voiceCallReasonRemoteLeft";
    case "left_by_user":
      return "messaging.voiceCallReasonLeftByUser";
    default:
      return null;
  }
};

const wantsVideoCallType = (
  requested: RequestedCallType | undefined,
): boolean => requested === "video" || requested === "av";

/**
 * Strict both-peer video capability gate (CRDT / optional preflight).
 * Prefer `resolveCallTypeFromInvite` for live UI so A/B chrome stays symmetric.
 */
export const resolveSupportedCallType = (
  requested: RequestedCallType | undefined,
  options?: Readonly<{
    localSupportsVideo?: boolean;
    remoteSupportsVideo?: boolean;
  }>,
): SupportedCallType => {
  if (!wantsVideoCallType(requested)) {
    return "voice";
  }
  if (options?.localSupportsVideo === true && options?.remoteSupportsVideo === true) {
    return "video";
  }
  return "voice";
};

/** Dock shows local/remote video panes (placeholders OK) only for negotiated video. */
export const shouldShowVideoCallPanes = (
  callType: SupportedCallType | undefined,
): boolean => callType === "video";

/**
 * UI call type from invite wire intent — must match both peers on the same room.
 * Host dials with callType video; joiner must not demote to voice when local camera
 * capability is false (that is mediaMode audio_only_fallback, not call-type demotion).
 * `localSupportsVideo` is accepted for API stability; it does not change UI type.
 */
export const resolveCallTypeFromInvite = (params: Readonly<{
  inviteCallType?: RequestedCallType;
  inviteAdvertisesVideo?: boolean;
  localSupportsVideo: boolean;
}>): SupportedCallType => {
  void params.localSupportsVideo;
  if (wantsVideoCallType(params.inviteCallType) || params.inviteAdvertisesVideo === true) {
    return "video";
  }
  return "voice";
};
