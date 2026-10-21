/**
 * Preserve negotiated callType/mediaMode when phase-only status patches run
 * (e.g. ensureVoicePeerConnection → connecting, RTC → connected).
 */

import type { CallLocalMediaMode } from "./realtime-call-local-media";
import type { SupportedCallType } from "./voice-call-reason-honesty";

export type VoiceCallUiStatusMediaFields = Readonly<{
  callType?: SupportedCallType;
  mediaMode?: CallLocalMediaMode;
}>;

export const preserveVoiceCallUiStatusMedia = (params: Readonly<{
  roomId: string;
  previous: Readonly<{
    roomId: string;
    callType?: SupportedCallType;
    mediaMode?: CallLocalMediaMode;
  }> | null | undefined;
}>): VoiceCallUiStatusMediaFields => {
  if (!params.previous || params.previous.roomId !== params.roomId) {
    return {};
  }
  return {
    ...(params.previous.callType ? { callType: params.previous.callType } : {}),
    ...(params.previous.mediaMode ? { mediaMode: params.previous.mediaMode } : {}),
  };
};

/** Invite card / toast: treat video|av as video invite copy. */
export const isVideoCallInviteRequest = (params: Readonly<{
  callType?: string | null;
  advertisesVideo?: boolean;
}>): boolean => (
  params.callType === "video"
  || params.callType === "av"
  || params.advertisesVideo === true
);
