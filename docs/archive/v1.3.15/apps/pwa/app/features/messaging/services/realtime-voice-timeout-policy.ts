export type RealtimeVoiceConnectPhase = "ringing_outgoing" | "connecting";

type RealtimeVoiceConnectTimeoutDecision = Readonly<{
  action: "extend" | "end";
  reasonCode:
    | "connecting_progress_detected"
    | "phase_not_eligible"
    | "no_active_session"
    | "extension_budget_exhausted"
    | "no_transport_progress";
}>;

export const resolveRealtimeVoiceConnectTimeoutDecision = (params: Readonly<{
  phase: RealtimeVoiceConnectPhase;
  hasActiveSession: boolean;
  rtcConnectionState: RTCPeerConnectionState | "none";
  hasLocalDescription: boolean;
  hasRemoteDescription: boolean;
  extensionAttemptCount: number;
  maxExtensionAttempts: number;
}>): RealtimeVoiceConnectTimeoutDecision => {
  if (params.phase !== "connecting") {
    return {
      action: "end",
      reasonCode: "phase_not_eligible",
    };
  }
  if (!params.hasActiveSession) {
    return {
      action: "end",
      reasonCode: "no_active_session",
    };
  }
  if (params.extensionAttemptCount >= params.maxExtensionAttempts) {
    return {
      action: "end",
      reasonCode: "extension_budget_exhausted",
    };
  }

  const hasTransportProgressEvidence = (
    params.rtcConnectionState === "connecting"
    || params.hasLocalDescription
    || params.hasRemoteDescription
  );
  if (!hasTransportProgressEvidence) {
    return {
      action: "end",
      reasonCode: "no_transport_progress",
    };
  }

  return {
    action: "extend",
    reasonCode: "connecting_progress_detected",
  };
};