/**
 * Keep negotiated callType/mediaMode when RTC phase updates replace UI status.
 * Missing this made Video dial look like a voice call after connecting.
 */

export type VoiceCallMediaFields = Readonly<{
  callType?: "voice" | "video";
  mediaMode?: "audio" | "av" | "audio_only_fallback" | "av_lab_canvas";
}>;

export const preserveVoiceCallMediaFields = (
  previous: Readonly<{ roomId: string } & VoiceCallMediaFields> | null | undefined,
  nextRoomId: string,
): VoiceCallMediaFields => {
  if (!previous || previous.roomId !== nextRoomId.trim()) {
    return {};
  }
  return {
    ...(previous.callType ? { callType: previous.callType } : {}),
    ...(previous.mediaMode ? { mediaMode: previous.mediaMode } : {}),
  };
};

export const isVoiceCallInviteVideoRequested = (invite: Readonly<{
  callType?: "voice" | "video" | "av";
  capabilities?: Readonly<{ video?: boolean }>;
}>): boolean => (
  invite.callType === "video"
  || invite.callType === "av"
  || invite.capabilities?.video === true
);
