import { describe, expect, it } from "vitest";
import {
  mapRealtimeVoiceConnectTimeoutToUiReasonCode,
  REALTIME_VOICE_CONNECT_TIMEOUT_DEGRADED_MAX_EXTENSIONS,
  resolveRealtimeVoiceConnectTimeoutDecision,
  resolveRealtimeVoiceConnectTimeoutMaxExtensions,
} from "./realtime-voice-timeout-policy";

describe("realtime-voice-timeout-policy", () => {
  it("extends connecting timeout when transport progress evidence exists", () => {
    const decision = resolveRealtimeVoiceConnectTimeoutDecision({
      phase: "connecting",
      hasActiveSession: true,
      rtcConnectionState: "connecting",
      hasLocalDescription: true,
      hasRemoteDescription: false,
      extensionAttemptCount: 0,
      maxExtensionAttempts: 1,
    });

    expect(decision).toEqual({
      action: "extend",
      reasonCode: "connecting_progress_detected",
    });
  });

  it("ends timeout when extension budget is exhausted", () => {
    const decision = resolveRealtimeVoiceConnectTimeoutDecision({
      phase: "connecting",
      hasActiveSession: true,
      rtcConnectionState: "connecting",
      hasLocalDescription: true,
      hasRemoteDescription: true,
      extensionAttemptCount: 1,
      maxExtensionAttempts: 1,
    });

    expect(decision).toEqual({
      action: "end",
      reasonCode: "extension_budget_exhausted",
    });
  });

  it("does not extend ringing_outgoing phase", () => {
    const decision = resolveRealtimeVoiceConnectTimeoutDecision({
      phase: "ringing_outgoing",
      hasActiveSession: true,
      rtcConnectionState: "connecting",
      hasLocalDescription: true,
      hasRemoteDescription: false,
      extensionAttemptCount: 0,
      maxExtensionAttempts: 1,
    });

    expect(decision).toEqual({
      action: "end",
      reasonCode: "phase_not_eligible",
    });
  });

  it("does not extend ringing_incoming phase (callee no silent hang)", () => {
    const decision = resolveRealtimeVoiceConnectTimeoutDecision({
      phase: "ringing_incoming",
      hasActiveSession: true,
      rtcConnectionState: "new",
      hasLocalDescription: false,
      hasRemoteDescription: false,
      extensionAttemptCount: 0,
      maxExtensionAttempts: 1,
    });

    expect(decision).toEqual({
      action: "end",
      reasonCode: "phase_not_eligible",
    });
    expect(mapRealtimeVoiceConnectTimeoutToUiReasonCode(decision.reasonCode)).toBe("session_closed");
  });

  it("does not extend when active session ownership is missing", () => {
    const decision = resolveRealtimeVoiceConnectTimeoutDecision({
      phase: "connecting",
      hasActiveSession: false,
      rtcConnectionState: "connecting",
      hasLocalDescription: true,
      hasRemoteDescription: true,
      extensionAttemptCount: 0,
      maxExtensionAttempts: 1,
    });

    expect(decision).toEqual({
      action: "end",
      reasonCode: "no_active_session",
    });
  });

  it("does not extend when there is no transport progress evidence", () => {
    const decision = resolveRealtimeVoiceConnectTimeoutDecision({
      phase: "connecting",
      hasActiveSession: true,
      rtcConnectionState: "new",
      hasLocalDescription: false,
      hasRemoteDescription: false,
      extensionAttemptCount: 0,
      maxExtensionAttempts: 1,
    });

    expect(decision).toEqual({
      action: "end",
      reasonCode: "no_transport_progress",
    });
  });

  it("maps transport timeout ends to network_interrupted honesty", () => {
    expect(mapRealtimeVoiceConnectTimeoutToUiReasonCode("no_transport_progress")).toBe(
      "network_interrupted",
    );
    expect(mapRealtimeVoiceConnectTimeoutToUiReasonCode("extension_budget_exhausted")).toBe(
      "network_interrupted",
    );
  });

  it("maps ring / missing-session ends to session_closed honesty", () => {
    expect(mapRealtimeVoiceConnectTimeoutToUiReasonCode("phase_not_eligible")).toBe("session_closed");
    expect(mapRealtimeVoiceConnectTimeoutToUiReasonCode("no_active_session")).toBe("session_closed");
  });

  it("raises connecting extension budget when relay pool is degraded", () => {
    expect(resolveRealtimeVoiceConnectTimeoutMaxExtensions({
      openRelayCount: 2,
      configuredRelayCount: 3,
      hasLocalDescription: false,
      hasRemoteDescription: false,
      baselineMaxExtensionAttempts: 1,
    })).toBe(REALTIME_VOICE_CONNECT_TIMEOUT_DEGRADED_MAX_EXTENSIONS);
  });

  it("raises connecting extension budget when both SDP sides exist", () => {
    expect(resolveRealtimeVoiceConnectTimeoutMaxExtensions({
      openRelayCount: 3,
      configuredRelayCount: 3,
      hasLocalDescription: true,
      hasRemoteDescription: true,
      baselineMaxExtensionAttempts: 1,
    })).toBe(REALTIME_VOICE_CONNECT_TIMEOUT_DEGRADED_MAX_EXTENSIONS);
  });

  it("keeps baseline when relays are healthy and SDP is incomplete", () => {
    expect(resolveRealtimeVoiceConnectTimeoutMaxExtensions({
      openRelayCount: 3,
      configuredRelayCount: 3,
      hasLocalDescription: true,
      hasRemoteDescription: false,
      baselineMaxExtensionAttempts: 1,
    })).toBe(1);
  });
});