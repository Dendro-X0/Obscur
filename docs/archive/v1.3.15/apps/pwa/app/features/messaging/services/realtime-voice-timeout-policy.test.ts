import { describe, expect, it } from "vitest";
import { resolveRealtimeVoiceConnectTimeoutDecision } from "./realtime-voice-timeout-policy";

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
});