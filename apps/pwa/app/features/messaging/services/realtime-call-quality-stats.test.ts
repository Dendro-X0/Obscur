import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  emitRealtimeCallQualitySample,
  parseRealtimeCallQualitySnapshot,
  REALTIME_CALL_QUALITY_SAMPLE_MIN_INTERVAL_MS,
  resolveRealtimeCallQualitySampleLevel,
  shouldEmitRealtimeCallQualitySample,
} from "./realtime-call-quality-stats";

const createReport = (rows: ReadonlyArray<Record<string, unknown>>): Iterable<unknown> => rows;

describe("realtime-call-quality-stats", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__obscur_log_hygiene_registry__ = new Map();
    (globalThis as Record<string, unknown>).__obscur_app_event_buffer__ = [];
    delete (globalThis as Record<string, unknown>).obscurAppEvents;
    vi.restoreAllMocks();
  });

  it("parses nominated candidate-pair RTT and inbound audio loss/jitter", () => {
    const snapshot = parseRealtimeCallQualitySnapshot({
      sampledAtUnixMs: 1_700,
      connectionState: "connected",
      iceConnectionState: "connected",
      report: createReport([
        {
          type: "candidate-pair",
          state: "succeeded",
          nominated: true,
          currentRoundTripTime: 0.085,
        },
        {
          type: "inbound-rtp",
          kind: "audio",
          packetsReceived: 920,
          packetsLost: 80,
          jitter: 0.012,
          bytesReceived: 48_000,
        },
        {
          type: "inbound-rtp",
          kind: "video",
          packetsReceived: 10,
          packetsLost: 0,
          bytesReceived: 120_000,
        },
      ]),
    });

    expect(snapshot).toEqual({
      sampledAtUnixMs: 1_700,
      connectionState: "connected",
      iceConnectionState: "connected",
      rttMs: 85,
      audioPacketLossRatio: 80 / 1_000,
      audioJitterMs: 12,
      inboundAudioBytes: 48_000,
      inboundVideoBytes: 120_000,
      hasInboundVideoEvidence: true,
    });
  });

  it("falls back to first succeeded pair and legacy mediaType; skips malformed rows", () => {
    const snapshot = parseRealtimeCallQualitySnapshot({
      sampledAtUnixMs: 2_000,
      report: createReport([
        null as unknown as Record<string, unknown>,
        { type: "candidate-pair", state: "failed", currentRoundTripTime: 9 },
        { type: "candidate-pair", state: "succeeded", currentRoundTripTime: 0.2 },
        {
          type: "inbound-rtp",
          mediaType: "audio",
          packetsReceived: 100,
          packetsLost: 0,
          jitter: 25,
          bytesReceived: 1_000,
        },
      ]),
    });

    expect(snapshot.rttMs).toBe(200);
    expect(snapshot.audioPacketLossRatio).toBe(0);
    expect(snapshot.audioJitterMs).toBe(25);
    expect(snapshot.hasInboundVideoEvidence).toBe(false);
    expect(snapshot.connectionState).toBe("unknown");
  });

  it("returns null metrics when report is empty", () => {
    const snapshot = parseRealtimeCallQualitySnapshot({
      sampledAtUnixMs: 3_000,
      report: createReport([]),
    });
    expect(snapshot.rttMs).toBeNull();
    expect(snapshot.audioPacketLossRatio).toBeNull();
    expect(snapshot.audioJitterMs).toBeNull();
    expect(snapshot.inboundAudioBytes).toBeNull();
    expect(snapshot.inboundVideoBytes).toBeNull();
    expect(snapshot.hasInboundVideoEvidence).toBe(false);
  });

  it("gates emit to connected phase and min interval", () => {
    expect(shouldEmitRealtimeCallQualitySample({
      phase: "connecting",
      lastEmitUnixMs: null,
      nowUnixMs: 1_000,
    })).toBe(false);

    expect(shouldEmitRealtimeCallQualitySample({
      phase: "connected",
      lastEmitUnixMs: null,
      nowUnixMs: 1_000,
    })).toBe(true);

    expect(shouldEmitRealtimeCallQualitySample({
      phase: "connected",
      lastEmitUnixMs: 1_000,
      nowUnixMs: 1_000 + REALTIME_CALL_QUALITY_SAMPLE_MIN_INTERVAL_MS - 1,
    })).toBe(false);

    expect(shouldEmitRealtimeCallQualitySample({
      phase: "connected",
      lastEmitUnixMs: 1_000,
      nowUnixMs: 1_000 + REALTIME_CALL_QUALITY_SAMPLE_MIN_INTERVAL_MS,
    })).toBe(true);
  });

  it("maps warn level from loss and RTT thresholds", () => {
    const base = parseRealtimeCallQualitySnapshot({
      sampledAtUnixMs: 1,
      report: createReport([]),
    });
    expect(resolveRealtimeCallQualitySampleLevel({
      ...base,
      audioPacketLossRatio: 0.079,
      rttMs: 399,
    })).toBe("info");
    expect(resolveRealtimeCallQualitySampleLevel({
      ...base,
      audioPacketLossRatio: 0.08,
      rttMs: null,
    })).toBe("warn");
    expect(resolveRealtimeCallQualitySampleLevel({
      ...base,
      audioPacketLossRatio: null,
      rttMs: 400,
    })).toBe("warn");
  });

  it("emits quality_sample diagnostic with compact context", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const snapshot = parseRealtimeCallQualitySnapshot({
      sampledAtUnixMs: 5_000,
      connectionState: "connected",
      iceConnectionState: "connected",
      report: createReport([
        {
          type: "candidate-pair",
          state: "succeeded",
          nominated: true,
          currentRoundTripTime: 0.05,
        },
        {
          type: "inbound-rtp",
          kind: "audio",
          packetsReceived: 100,
          packetsLost: 0,
          jitter: 0.004,
          bytesReceived: 2_000,
        },
      ]),
    });

    emitRealtimeCallQualitySample({
      roomIdHint: "roomhint1",
      role: "host",
      snapshot,
    });

    const diagnosticsApi = (globalThis as {
      obscurAppEvents?: {
        findByName: (name: string, count?: number) => ReadonlyArray<{
          name: string;
          level: string;
          context?: Record<string, unknown>;
        }>;
      };
    }).obscurAppEvents;

    const events = diagnosticsApi?.findByName("messaging.realtime_voice.quality_sample", 5) ?? [];
    expect(events).toHaveLength(1);
    expect(events[0]?.level).toBe("info");
    expect(events[0]?.context).toEqual(expect.objectContaining({
      roomIdHint: "roomhint1",
      role: "host",
      rttMs: 50,
      audioPacketLossRatio: 0,
      hasInboundVideoEvidence: false,
    }));
  });
});
