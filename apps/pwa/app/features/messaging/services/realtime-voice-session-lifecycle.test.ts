import { describe, expect, it } from "vitest";
import type { RealtimeVoiceCapability } from "./realtime-voice-capability";
import {
  createInitialRealtimeVoiceSessionState,
  isRealtimeVoiceSessionInteractive,
  markRealtimeVoiceSessionConnected,
  markRealtimeVoiceSessionLeft,
  markRealtimeVoiceSessionRecoveryFailed,
  markRealtimeVoiceSessionTransportDegraded,
  requestRealtimeVoiceSessionLeave,
  requestRealtimeVoiceSessionRecovery,
  startRealtimeVoiceSession,
} from "./realtime-voice-session-lifecycle";

const SUPPORTED_CAPABILITY: RealtimeVoiceCapability = {
  supported: true,
  reasonCode: "supported",
  isSecureContext: true,
  hasMediaDevices: true,
  hasPeerConnection: true,
  hasAddTrack: true,
  opusCapabilityStatus: "available",
};

const UNSUPPORTED_CAPABILITY: RealtimeVoiceCapability = {
  supported: false,
  reasonCode: "webrtc_unavailable",
  isSecureContext: true,
  hasMediaDevices: true,
  hasPeerConnection: false,
  hasAddTrack: false,
  opusCapabilityStatus: "unknown",
};

describe("realtime-voice-session-lifecycle", () => {
  it("starts as unsupported when capability is unavailable", () => {
    const initial = createInitialRealtimeVoiceSessionState();

    const next = startRealtimeVoiceSession(initial, {
      roomId: "room-a",
      mode: "join",
      capability: UNSUPPORTED_CAPABILITY,
      nowUnixMs: 1_000,
    });

    expect(next).toEqual(expect.objectContaining({
      phase: "unsupported",
      roomId: "room-a",
      mode: "join",
      lastTransitionReasonCode: "webrtc_unavailable",
    }));
  });

  it("starts as degraded when opus codec is missing", () => {
    const initial = createInitialRealtimeVoiceSessionState();

    const next = startRealtimeVoiceSession(initial, {
      roomId: "room-a",
      mode: "create",
      capability: { ...SUPPORTED_CAPABILITY, opusCapabilityStatus: "missing" },
      nowUnixMs: 2_000,
    });

    expect(next).toEqual(expect.objectContaining({
      phase: "degraded",
      lastTransitionReasonCode: "opus_codec_missing",
      participantCount: 1,
    }));
  });

  it("requires peer evidence before transitioning to active", () => {
    const initial = createInitialRealtimeVoiceSessionState();
    const started = startRealtimeVoiceSession(initial, {
      roomId: "room-a",
      mode: "join",
      capability: SUPPORTED_CAPABILITY,
      nowUnixMs: 3_000,
    });

    const noEvidence = markRealtimeVoiceSessionConnected(started, {
      participantCount: 2,
      hasPeerSessionEvidence: false,
      nowUnixMs: 3_100,
    });

    expect(noEvidence).toEqual(expect.objectContaining({
      phase: "degraded",
      hasPeerSessionEvidence: false,
      lastTransitionReasonCode: "peer_evidence_missing",
    }));
  });

  it("transitions to active when peer evidence is present", () => {
    const initial = createInitialRealtimeVoiceSessionState();
    const started = startRealtimeVoiceSession(initial, {
      roomId: "room-a",
      mode: "join",
      capability: SUPPORTED_CAPABILITY,
      nowUnixMs: 4_000,
    });

    const connected = markRealtimeVoiceSessionConnected(started, {
      participantCount: 3,
      hasPeerSessionEvidence: true,
      nowUnixMs: 4_100,
    });

    expect(connected).toEqual(expect.objectContaining({
      phase: "active",
      hasPeerSessionEvidence: true,
      participantCount: 3,
      lastTransitionReasonCode: "none",
    }));
    expect(isRealtimeVoiceSessionInteractive(connected)).toBe(true);
  });

  it("supports degraded to recovery to active flow", () => {
    const initial = createInitialRealtimeVoiceSessionState();
    const started = startRealtimeVoiceSession(initial, {
      roomId: "room-a",
      mode: "join",
      capability: SUPPORTED_CAPABILITY,
      nowUnixMs: 5_000,
    });
    const degraded = markRealtimeVoiceSessionTransportDegraded(started, {
      reasonCode: "network_degraded",
      nowUnixMs: 5_100,
    });

    const recovering = requestRealtimeVoiceSessionRecovery(degraded, { nowUnixMs: 5_200 });
    const recovered = markRealtimeVoiceSessionConnected(recovering, {
      participantCount: 2,
      hasPeerSessionEvidence: true,
      nowUnixMs: 5_300,
    });

    expect(recovering).toEqual(expect.objectContaining({
      phase: "connecting",
      recoveryAttemptCount: 1,
    }));
    expect(recovered).toEqual(expect.objectContaining({
      phase: "active",
      hasPeerSessionEvidence: true,
      lastTransitionReasonCode: "none",
    }));
  });

  it("ends session when recovery attempts are exhausted", () => {
    const initial = createInitialRealtimeVoiceSessionState({ maxRecoveryAttempts: 1 });
    const started = startRealtimeVoiceSession(initial, {
      roomId: "room-a",
      mode: "join",
      capability: SUPPORTED_CAPABILITY,
      nowUnixMs: 6_000,
      maxRecoveryAttempts: 1,
    });
    const degraded = markRealtimeVoiceSessionTransportDegraded(started, {
      reasonCode: "transport_timeout",
      nowUnixMs: 6_100,
    });
    const recovering = requestRealtimeVoiceSessionRecovery(degraded, { nowUnixMs: 6_200 });
    const failed = markRealtimeVoiceSessionRecoveryFailed(recovering, {
      reasonCode: "transport_timeout",
      nowUnixMs: 6_300,
    });

    expect(failed).toEqual(expect.objectContaining({
      phase: "ended",
      participantCount: 0,
      hasPeerSessionEvidence: false,
      lastTransitionReasonCode: "recovery_exhausted",
    }));
    expect(isRealtimeVoiceSessionInteractive(failed)).toBe(false);
  });

  it("handles leave flow deterministically", () => {
    const initial = createInitialRealtimeVoiceSessionState();
    const started = startRealtimeVoiceSession(initial, {
      roomId: "room-a",
      mode: "create",
      capability: SUPPORTED_CAPABILITY,
      nowUnixMs: 7_000,
    });
    const active = markRealtimeVoiceSessionConnected(started, {
      participantCount: 2,
      hasPeerSessionEvidence: true,
      nowUnixMs: 7_100,
    });
    const leaving = requestRealtimeVoiceSessionLeave(active, { nowUnixMs: 7_200 });
    const ended = markRealtimeVoiceSessionLeft(leaving, {
      nowUnixMs: 7_300,
      reasonCode: "left_by_user",
    });

    expect(leaving).toEqual(expect.objectContaining({
      phase: "leaving",
      lastTransitionReasonCode: "none",
    }));
    expect(ended).toEqual(expect.objectContaining({
      phase: "ended",
      participantCount: 0,
      lastTransitionReasonCode: "left_by_user",
    }));
  });

  it("returns invalid_transition for out-of-order lifecycle operations", () => {
    const initial = createInitialRealtimeVoiceSessionState();

    const invalidRecovery = requestRealtimeVoiceSessionRecovery(initial, { nowUnixMs: 8_000 });
    const invalidLeave = requestRealtimeVoiceSessionLeave(initial, { nowUnixMs: 8_100 });

    expect(invalidRecovery).toEqual(expect.objectContaining({
      phase: "idle",
      lastTransitionReasonCode: "invalid_transition",
    }));
    expect(invalidLeave).toEqual(expect.objectContaining({
      phase: "idle",
      lastTransitionReasonCode: "invalid_transition",
    }));
  });
});
