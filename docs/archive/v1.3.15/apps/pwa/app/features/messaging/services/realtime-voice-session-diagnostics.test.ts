import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInitialRealtimeVoiceSessionState,
  markRealtimeVoiceSessionTransportDegraded,
  startRealtimeVoiceSession,
} from "./realtime-voice-session-lifecycle";
import { emitRealtimeVoiceSessionTransitionDiagnostic } from "./realtime-voice-session-diagnostics";

describe("realtime-voice-session-diagnostics", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__obscur_log_hygiene_registry__ = new Map();
    (globalThis as Record<string, unknown>).__obscur_app_event_buffer__ = [];
    delete (globalThis as Record<string, unknown>).obscurAppEvents;
    vi.restoreAllMocks();
  });

  it("emits info transition diagnostics for supported connect flow", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const previous = createInitialRealtimeVoiceSessionState();
    const next = startRealtimeVoiceSession(previous, {
      roomId: "room-voice-1234",
      mode: "join",
      capability: {
        supported: true,
        reasonCode: "supported",
        isSecureContext: true,
        hasMediaDevices: true,
        hasPeerConnection: true,
        hasAddTrack: true,
        opusCapabilityStatus: "available",
      },
      nowUnixMs: 1_000,
    });

    const emitted = emitRealtimeVoiceSessionTransitionDiagnostic({
      previousState: previous,
      nextState: next,
    });

    expect(emitted).toBe(true);
    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        level: string;
        context?: Record<string, unknown>;
      }>;
    };
    const events = diagnosticsApi.findByName("messaging.realtime_voice.session_transition", 10);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      level: "info",
      context: expect.objectContaining({
        toPhase: "connecting",
        mode: "join",
        reasonCode: "none",
      }),
    }));
  });

  it("emits warn transition diagnostics for degraded flow", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const initial = createInitialRealtimeVoiceSessionState();
    const started = startRealtimeVoiceSession(initial, {
      roomId: "room-voice-1234",
      mode: "create",
      capability: {
        supported: true,
        reasonCode: "supported",
        isSecureContext: true,
        hasMediaDevices: true,
        hasPeerConnection: true,
        hasAddTrack: true,
        opusCapabilityStatus: "available",
      },
      nowUnixMs: 2_000,
    });
    const degraded = markRealtimeVoiceSessionTransportDegraded(started, {
      reasonCode: "network_degraded",
      nowUnixMs: 2_100,
    });

    emitRealtimeVoiceSessionTransitionDiagnostic({
      previousState: started,
      nextState: degraded,
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        level: string;
        context?: Record<string, unknown>;
      }>;
    };
    const events = diagnosticsApi.findByName("messaging.realtime_voice.session_transition", 10);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      level: "warn",
      context: expect.objectContaining({
        fromPhase: "connecting",
        toPhase: "degraded",
        reasonCode: "network_degraded",
        isRecoverable: true,
      }),
    }));
  });

  it("does not emit diagnostic when transition-relevant state did not change", () => {
    const initial = createInitialRealtimeVoiceSessionState();

    const emitted = emitRealtimeVoiceSessionTransitionDiagnostic({
      previousState: initial,
      nextState: initial,
    });

    expect(emitted).toBe(false);
    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as
      | {
        findByName: (name: string, count?: number) => ReadonlyArray<unknown>;
      }
      | undefined;
    if (diagnosticsApi) {
      expect(diagnosticsApi.findByName("messaging.realtime_voice.session_transition", 10)).toHaveLength(0);
    }
  });
});
