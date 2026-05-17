import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RealtimeVoiceCapability } from "./realtime-voice-capability";
import { createRealtimeVoiceSessionOwner } from "./realtime-voice-session-owner";

const SUPPORTED_CAPABILITY: RealtimeVoiceCapability = {
  supported: true,
  reasonCode: "supported",
  isSecureContext: true,
  hasMediaDevices: true,
  hasPeerConnection: true,
  hasAddTrack: true,
  opusCapabilityStatus: "available",
};

describe("realtime-voice-session-owner", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__obscur_log_hygiene_registry__ = new Map();
    (globalThis as Record<string, unknown>).__obscur_app_event_buffer__ = [];
    delete (globalThis as Record<string, unknown>).obscurAppEvents;
    vi.restoreAllMocks();
  });

  it("applies ordered transitions and emits diagnostics", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const owner = createRealtimeVoiceSessionOwner();

    const started = owner.start({
      roomId: "room-owner-ordered",
      mode: "join",
      capability: SUPPORTED_CAPABILITY,
      eventUnixMs: 1_000,
    });
    const connected = owner.connected({
      participantCount: 2,
      hasPeerSessionEvidence: true,
      eventUnixMs: 1_100,
    });

    expect(started.phase).toBe("connecting");
    expect(connected.phase).toBe("active");

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const transitions = diagnosticsApi.findByName("messaging.realtime_voice.session_transition", 10);
    expect(transitions).toHaveLength(2);
    expect(transitions[1]?.context).toEqual(expect.objectContaining({
      fromPhase: "connecting",
      toPhase: "active",
      reasonCode: "none",
    }));
  });

  it("ignores stale transitions and preserves canonical newer state", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const owner = createRealtimeVoiceSessionOwner();

    owner.start({
      roomId: "room-owner-stale",
      mode: "join",
      capability: SUPPORTED_CAPABILITY,
      eventUnixMs: 2_000,
    });
    owner.connected({
      participantCount: 2,
      hasPeerSessionEvidence: true,
      eventUnixMs: 2_100,
    });
    const degraded = owner.transportDegraded({
      reasonCode: "network_degraded",
      eventUnixMs: 2_300,
    });
    const staleConnect = owner.connected({
      participantCount: 3,
      hasPeerSessionEvidence: true,
      eventUnixMs: 2_200,
    });

    expect(staleConnect).toBe(degraded);
    expect(staleConnect).toEqual(expect.objectContaining({
      phase: "degraded",
      lastTransitionReasonCode: "network_degraded",
      lastTransitionAtUnixMs: 2_300,
    }));

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const ignored = diagnosticsApi.findByName("messaging.realtime_voice.session_event_ignored", 10);
    expect(ignored).toHaveLength(1);
    expect(ignored[0]?.context).toEqual(expect.objectContaining({
      reasonCode: "stale_event",
      phase: "degraded",
      eventUnixMs: 2_200,
      lastTransitionAtUnixMs: 2_300,
    }));
  });

  it("keeps first terminal outcome when stale close arrives after left", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const owner = createRealtimeVoiceSessionOwner();

    owner.start({
      roomId: "room-owner-terminal",
      mode: "create",
      capability: SUPPORTED_CAPABILITY,
      eventUnixMs: 3_000,
    });
    owner.connected({
      participantCount: 2,
      hasPeerSessionEvidence: true,
      eventUnixMs: 3_100,
    });
    owner.requestLeave({ eventUnixMs: 3_200 });
    const left = owner.left({
      reasonCode: "left_by_user",
      eventUnixMs: 3_300,
    });
    const staleClosed = owner.closed({ eventUnixMs: 3_250 });

    expect(staleClosed).toBe(left);
    expect(staleClosed).toEqual(expect.objectContaining({
      phase: "ended",
      lastTransitionReasonCode: "left_by_user",
      lastTransitionAtUnixMs: 3_300,
    }));
  });
});
