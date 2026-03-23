import { beforeEach, describe, expect, it, vi } from "vitest";
import { installM6VoiceCapture, m6VoiceCaptureInternals } from "./m6-voice-capture";

type MutableWindow = Window & Record<string, unknown>;

const getMutableWindow = (): MutableWindow => window as unknown as MutableWindow;

describe("m6-voice-capture", () => {
  beforeEach(() => {
    const root = getMutableWindow();
    delete root.obscurM6VoiceCapture;
    delete root.obscurAppEvents;
    delete root.obscurM0Triage;
    vi.restoreAllMocks();
  });

  it("installs helper and captures realtime voice diagnostics bundle", () => {
    const root = getMutableWindow();
    root.obscurAppEvents = {
      getCrossDeviceSyncDigest: () => ({
        summary: {
          realtimeVoiceSession: {
            riskLevel: "watch",
            transitionCount: 4,
            degradedCount: 2,
            unsupportedCount: 0,
            recoveryExhaustedCount: 0,
            latestToPhase: "degraded",
            latestReasonCode: "network_degraded",
          },
        },
        recentWarnOrError: [{
          name: "messaging.realtime_voice.session_transition",
          level: "warn",
          atUnixMs: 42,
          reasonCode: "network_degraded",
        }],
      }),
      findByName: (name: string) => [{ name, atUnixMs: 43, level: "warn" }],
    };
    (root as Record<string, unknown>).obscurM0Triage = {
      capture: () => ({ tag: "m0" }),
    };

    installM6VoiceCapture();

    const api = root.obscurM6VoiceCapture as {
      capture: (eventWindowSize?: number) => unknown;
      captureJson: (eventWindowSize?: number) => string;
    };
    expect(api).toBeTruthy();

    const bundle = api.capture(320) as {
      checks: { requiredApis: Record<string, boolean> };
      voice: {
        summary: Record<string, unknown> | null;
        transitions: Array<{ name: string }>;
        recentWarnOrError: Array<{ reasonCode: string | null }>;
      };
      m0Triage: unknown;
    };

    expect(bundle.checks.requiredApis.appEvents).toBe(true);
    expect(bundle.checks.requiredApis.m0Triage).toBe(true);
    expect(bundle.voice.summary).toEqual(expect.objectContaining({
      riskLevel: "watch",
      transitionCount: 4,
      degradedCount: 2,
      latestReasonCode: "network_degraded",
    }));
    expect(bundle.voice.transitions[0]?.name).toBe("messaging.realtime_voice.session_transition");
    expect(bundle.voice.recentWarnOrError[0]?.reasonCode).toBe("network_degraded");
    expect(bundle.m0Triage).toEqual({ tag: "m0" });
    expect(() => JSON.parse(api.captureJson(320))).not.toThrow();
  });

  it("fails open when APIs are unavailable", () => {
    const root = getMutableWindow();
    installM6VoiceCapture();

    const api = root.obscurM6VoiceCapture as { capture: (eventWindowSize?: number) => unknown };
    const bundle = api.capture() as {
      checks: { requiredApis: Record<string, boolean> };
      voice: {
        summary: unknown;
        transitions: unknown[];
        recentWarnOrError: unknown[];
      };
      m0Triage: unknown;
    };

    expect(bundle.checks.requiredApis.appEvents).toBe(false);
    expect(bundle.checks.requiredApis.m0Triage).toBe(false);
    expect(bundle.voice.summary).toBeNull();
    expect(bundle.voice.transitions).toEqual([]);
    expect(bundle.voice.recentWarnOrError).toEqual([]);
    expect(bundle.m0Triage).toBeNull();
  });

  it("normalizes malformed summary payloads and invalid window values", () => {
    expect(m6VoiceCaptureInternals.parseRealtimeVoiceSummary(null)).toBeNull();
    expect(m6VoiceCaptureInternals.parseRealtimeVoiceSummary({ riskLevel: "broken" })).toBeNull();
    expect(m6VoiceCaptureInternals.parseRealtimeVoiceSummary({
      riskLevel: "high",
      transitionCount: 5,
      degradedCount: 2,
      unsupportedCount: 1,
      recoveryExhaustedCount: 1,
      latestToPhase: "ended",
      latestReasonCode: "recovery_exhausted",
    })).toEqual(expect.objectContaining({
      riskLevel: "high",
      transitionCount: 5,
      recoveryExhaustedCount: 1,
      latestReasonCode: "recovery_exhausted",
    }));
    expect(m6VoiceCaptureInternals.toNumericWindowSize(410.7)).toBe(410);
    expect(m6VoiceCaptureInternals.toNumericWindowSize(0)).toBe(1);
    expect(m6VoiceCaptureInternals.toNumericWindowSize(Number.NaN)).toBe(400);
  });
});
