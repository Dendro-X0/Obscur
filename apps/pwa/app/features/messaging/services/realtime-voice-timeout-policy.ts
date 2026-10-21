import type { VoiceCallLiveReasonCode } from "./voice-call-reason-honesty";

export type RealtimeVoiceConnectPhase = "ringing_outgoing" | "ringing_incoming" | "connecting";

export type RealtimeVoiceConnectTimeoutReasonCode =
  | "connecting_progress_detected"
  | "phase_not_eligible"
  | "no_active_session"
  | "extension_budget_exhausted"
  | "no_transport_progress";

type RealtimeVoiceConnectTimeoutDecision = Readonly<{
  action: "extend" | "end";
  reasonCode: RealtimeVoiceConnectTimeoutReasonCode;
}>;

/** When the pool is partial or SDP is already exchanged, allow more 30s connecting ticks. */
export const REALTIME_VOICE_CONNECT_TIMEOUT_DEGRADED_MAX_EXTENSIONS = 3;

/**
 * PB1-C: map timeout end reasons to dock honesty codes.
 * Transport stalls → network_interrupted; ring / missing session → session_closed.
 */
export const mapRealtimeVoiceConnectTimeoutToUiReasonCode = (
  reasonCode: RealtimeVoiceConnectTimeoutReasonCode,
): VoiceCallLiveReasonCode => {
  switch (reasonCode) {
    case "no_transport_progress":
    case "extension_budget_exhausted":
      return "network_interrupted";
    case "phase_not_eligible":
    case "no_active_session":
    case "connecting_progress_detected":
    default:
      return "session_closed";
  }
};

/**
 * Flaky-relay / slow ICE: raise connecting extension budget when the pool is degraded
 * or both SDP sides are present. Ring phases ignore this (no extend).
 */
export const resolveRealtimeVoiceConnectTimeoutMaxExtensions = (params: Readonly<{
  openRelayCount: number;
  configuredRelayCount: number;
  hasLocalDescription: boolean;
  hasRemoteDescription: boolean;
  baselineMaxExtensionAttempts: number;
}>): number => {
  const baseline = Number.isFinite(params.baselineMaxExtensionAttempts)
    ? Math.max(0, Math.floor(params.baselineMaxExtensionAttempts))
    : 0;
  const open = Number.isFinite(params.openRelayCount) ? Math.max(0, params.openRelayCount) : 0;
  const configured = Number.isFinite(params.configuredRelayCount)
    ? Math.max(0, params.configuredRelayCount)
    : 0;
  const degradedPool = open > 0 && configured > 0 && open < configured;
  const dualSdp = params.hasLocalDescription && params.hasRemoteDescription;
  if (degradedPool || dualSdp) {
    return Math.max(baseline, REALTIME_VOICE_CONNECT_TIMEOUT_DEGRADED_MAX_EXTENSIONS);
  }
  return baseline;
};

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