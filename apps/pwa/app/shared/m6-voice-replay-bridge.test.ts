import { beforeEach, describe, expect, it, vi } from "vitest";
import { installM6VoiceCapture } from "./m6-voice-capture";
import { installM6VoiceReplayBridge } from "./m6-voice-replay-bridge";

type MutableWindow = Window & Record<string, unknown>;

const getMutableWindow = (): MutableWindow => window as unknown as MutableWindow;

describe("m6-voice-replay-bridge", () => {
  beforeEach(() => {
    const root = getMutableWindow();
    delete root.obscurM6VoiceReplay;
    delete root.obscurM6VoiceCapture;
    delete root.obscurAppEvents;
    (globalThis as Record<string, unknown>).__obscur_app_event_buffer__ = [];
    (globalThis as Record<string, unknown>).__obscur_log_hygiene_registry__ = new Map();
    vi.restoreAllMocks();
  });

  it("installs replay bridge and emits transition diagnostics for weak-network replay", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runWeakNetworkReplay: () => { phase: string };
    };
    expect(replayApi).toBeTruthy();

    const finalState = replayApi.runWeakNetworkReplay();
    expect(finalState.phase).toBe("active");

    const diagnosticsApi = root.obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            transitionCount: number;
            degradedCount: number;
            recoveryExhaustedCount: number;
          };
        };
      };
    };
    const transitions = diagnosticsApi.findByName("messaging.realtime_voice.session_transition", 20);
    expect(transitions.length).toBeGreaterThanOrEqual(5);
    expect(transitions.some((event) => event.context?.toPhase === "degraded")).toBe(true);
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(200);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      transitionCount: expect.any(Number),
      degradedCount: 1,
      recoveryExhaustedCount: 0,
    }));
  });

  it("exports deterministic weak-network replay capture bundle with CP2 gate verdict", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runWeakNetworkReplayCapture: (params?: { clearAppEvents?: boolean; captureWindowSize?: number }) => {
        replay: {
          scenario: string;
          finalState: { phase: string };
          replayReadiness: { readyForCp2Evidence: boolean };
          transitionEventCount: number;
          degradedTransitionCount: number;
          recoveredActiveTransitionCount: number;
        } | null;
        capture: {
          voice: {
            summary: { degradedCount: number } | null;
            ignoredEvents: unknown[];
          };
        } | null;
        cp2EvidenceGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, unknown>;
        };
      };
      runWeakNetworkReplayCaptureJson: (params?: { clearAppEvents?: boolean; captureWindowSize?: number }) => string;
    };

    const bundle = replayApi.runWeakNetworkReplayCapture({
      clearAppEvents: true,
      captureWindowSize: 300,
    });
    expect(bundle.replay?.scenario).toBe("weak_network");
    expect(bundle.replay?.finalState.phase).toBe("active");
    expect(bundle.replay?.transitionEventCount).toBeGreaterThanOrEqual(5);
    expect(bundle.replay?.degradedTransitionCount).toBe(1);
    expect(bundle.replay?.recoveredActiveTransitionCount).toBeGreaterThanOrEqual(1);
    expect(bundle.replay?.replayReadiness.readyForCp2Evidence).toBe(true);
    expect(bundle.capture?.voice.summary?.degradedCount).toBe(1);
    expect(Array.isArray(bundle.capture?.voice.ignoredEvents)).toBe(true);
    expect(bundle.cp2EvidenceGate.pass).toBe(true);
    expect(bundle.cp2EvidenceGate.failedChecks).toEqual([]);
    expect(bundle.cp2EvidenceGate.checks.scenario).toBe("weak_network");
    expect(bundle.cp2EvidenceGate.checks.replayReadyForCp2).toBe(true);
    expect(() => JSON.parse(replayApi.runWeakNetworkReplayCaptureJson({
      clearAppEvents: true,
      captureWindowSize: 300,
    }))).not.toThrow();
  });

  it("exports deterministic account-switch replay capture bundle with CP2 gate verdict", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runAccountSwitchReplayCapture: (
        params?: { clearAppEvents?: boolean; captureWindowSize?: number },
      ) => {
        replay: {
          scenario: string;
          finalState: { phase: string };
          transitionEventCount: number;
          endedTransitionCount: number;
          roomHintCount: number;
          replayReadiness: { readyForCp2Evidence: boolean; hasPostSwitchActiveTransition: boolean };
        } | null;
        capture: {
          voice: {
            summary: { transitionCount: number } | null;
            ignoredEvents: unknown[];
          };
        } | null;
        cp2EvidenceGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, unknown>;
        };
      };
      runAccountSwitchReplayCaptureJson: (
        params?: { clearAppEvents?: boolean; captureWindowSize?: number },
      ) => string;
    };

    const bundle = replayApi.runAccountSwitchReplayCapture({
      clearAppEvents: true,
      captureWindowSize: 300,
    });
    expect(bundle.replay?.scenario).toBe("account_switch");
    expect(bundle.replay?.finalState.phase).toBe("active");
    expect(bundle.replay?.transitionEventCount).toBeGreaterThanOrEqual(6);
    expect(bundle.replay?.endedTransitionCount).toBeGreaterThanOrEqual(1);
    expect(bundle.replay?.roomHintCount).toBeGreaterThanOrEqual(2);
    expect(bundle.replay?.replayReadiness.hasPostSwitchActiveTransition).toBe(true);
    expect(bundle.replay?.replayReadiness.readyForCp2Evidence).toBe(true);
    expect(bundle.capture?.voice.summary?.transitionCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(bundle.capture?.voice.ignoredEvents)).toBe(true);
    expect(bundle.cp2EvidenceGate.pass).toBe(true);
    expect(bundle.cp2EvidenceGate.failedChecks).toEqual([]);
    expect(bundle.cp2EvidenceGate.checks.scenario).toBe("account_switch");
    expect(() => JSON.parse(replayApi.runAccountSwitchReplayCaptureJson({
      clearAppEvents: true,
      captureWindowSize: 300,
    }))).not.toThrow();
  });

  it("exports deterministic CP3 replay suite bundle with overall gate verdict", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp3ReplaySuiteCapture: (params?: { clearAppEvents?: boolean; captureWindowSize?: number }) => {
        weakNetwork: { cp2EvidenceGate: { pass: boolean } };
        accountSwitch: { cp2EvidenceGate: { pass: boolean } };
        suiteGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, boolean>;
        };
      };
      runCp3ReplaySuiteCaptureJson: (params?: { clearAppEvents?: boolean; captureWindowSize?: number }) => string;
    };

    const suite = replayApi.runCp3ReplaySuiteCapture({
      clearAppEvents: true,
      captureWindowSize: 300,
    });
    expect(suite.weakNetwork.cp2EvidenceGate.pass).toBe(true);
    expect(suite.accountSwitch.cp2EvidenceGate.pass).toBe(true);
    expect(suite.suiteGate.pass).toBe(true);
    expect(suite.suiteGate.failedChecks).toEqual([]);
    expect(suite.suiteGate.checks.weakNetworkPass).toBe(true);
    expect(suite.suiteGate.checks.accountSwitchPass).toBe(true);
    expect(suite.suiteGate.checks.weakAsyncVoiceSummaryPresent).toBe(true);
    expect(suite.suiteGate.checks.accountAsyncVoiceSummaryPresent).toBe(true);
    expect(suite.suiteGate.checks.weakDeleteSummaryPresent).toBe(true);
    expect(suite.suiteGate.checks.accountDeleteSummaryPresent).toBe(true);
    expect(suite.suiteGate.checks.weakAsyncVoiceStartFailureCountZero).toBe(true);
    expect(suite.suiteGate.checks.accountAsyncVoiceStartFailureCountZero).toBe(true);
    expect(suite.suiteGate.checks.weakDeleteRemoteFailureCountZero).toBe(true);
    expect(suite.suiteGate.checks.accountDeleteRemoteFailureCountZero).toBe(true);
    expect(() => JSON.parse(replayApi.runCp3ReplaySuiteCaptureJson({
      clearAppEvents: true,
      captureWindowSize: 300,
    }))).not.toThrow();
  });

  it("emits unsupported transition diagnostics when started with unsupported capability", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      start: (params: { supported: boolean; unsupportedReasonCode: string }) => { phase: string };
    };
    const next = replayApi.start({
      supported: false,
      unsupportedReasonCode: "webrtc_unavailable",
    });
    expect(next.phase).toBe("unsupported");

    const diagnosticsApi = root.obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const transitions = diagnosticsApi.findByName("messaging.realtime_voice.session_transition", 10);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.context).toEqual(expect.objectContaining({
      toPhase: "unsupported",
      reasonCode: "webrtc_unavailable",
    }));
  });
});
