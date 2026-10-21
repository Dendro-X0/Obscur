/**
 * PB1-C: when local media / RTCPeerConnection fails to start, the dock must
 * not stay on ringing/connecting with no toast.
 */

export type VoicePeerConnectionStartFailureUi = Readonly<{
  phase: "interrupted";
  reasonCode: "session_closed";
  toastKey: "messaging.voiceCallJoinConnectionFailed";
  logStatus: "peer_connection_start_failed";
}>;

export const resolveVoicePeerConnectionStartFailureUi = (): VoicePeerConnectionStartFailureUi => ({
  phase: "interrupted",
  reasonCode: "session_closed",
  toastKey: "messaging.voiceCallJoinConnectionFailed",
  logStatus: "peer_connection_start_failed",
});
