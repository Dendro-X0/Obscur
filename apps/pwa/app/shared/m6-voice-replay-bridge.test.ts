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
      runCp3ReplaySuiteGateProbe: (params?: { clearAppEvents?: boolean; captureWindowSize?: number }) => {
        pass: boolean;
        failedChecks: readonly string[];
        checks: Record<string, boolean>;
      };
      runCp3ReplaySuiteGateProbeJson: (params?: { clearAppEvents?: boolean; captureWindowSize?: number }) => string;
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
    expect(suite.suiteGate.checks.weakAsyncVoiceRiskNotHigh).toBe(true);
    expect(suite.suiteGate.checks.accountAsyncVoiceRiskNotHigh).toBe(true);
    expect(suite.suiteGate.checks.weakDeleteRiskNotHigh).toBe(true);
    expect(suite.suiteGate.checks.accountDeleteRiskNotHigh).toBe(true);
    expect(suite.suiteGate.checks.weakAsyncVoiceStartFailureCountZero).toBe(true);
    expect(suite.suiteGate.checks.accountAsyncVoiceStartFailureCountZero).toBe(true);
    expect(suite.suiteGate.checks.weakDeleteRemoteFailureCountZero).toBe(true);
    expect(suite.suiteGate.checks.accountDeleteRemoteFailureCountZero).toBe(true);
    const gateProbe = replayApi.runCp3ReplaySuiteGateProbe({
      clearAppEvents: true,
      captureWindowSize: 300,
    });
    expect(gateProbe.pass).toBe(true);
    expect(gateProbe.failedChecks).toEqual([]);
    expect(() => JSON.parse(replayApi.runCp3ReplaySuiteCaptureJson({
      clearAppEvents: true,
      captureWindowSize: 300,
    }))).not.toThrow();
    expect(() => JSON.parse(replayApi.runCp3ReplaySuiteGateProbeJson({
      clearAppEvents: true,
      captureWindowSize: 300,
    }))).not.toThrow();
  });

  it("fails CP3 suite gate deterministically when capture summaries are unavailable", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp3ReplaySuiteCapture: (params?: { clearAppEvents?: boolean; captureWindowSize?: number }) => {
        suiteGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, boolean>;
        };
      };
      runCp3ReplaySuiteGateProbe: (params?: { clearAppEvents?: boolean; captureWindowSize?: number }) => {
        pass: boolean;
        failedChecks: readonly string[];
        checks: Record<string, boolean>;
      };
    };

    const suite = replayApi.runCp3ReplaySuiteCapture({
      clearAppEvents: true,
      captureWindowSize: 300,
    });
    expect(suite.suiteGate.pass).toBe(false);
    expect(suite.suiteGate.failedChecks).toEqual(expect.arrayContaining([
      "weakAsyncVoiceSummaryPresent",
      "accountAsyncVoiceSummaryPresent",
      "weakDeleteSummaryPresent",
      "accountDeleteSummaryPresent",
      "weakAsyncVoiceRiskNotHigh",
      "accountAsyncVoiceRiskNotHigh",
      "weakDeleteRiskNotHigh",
      "accountDeleteRiskNotHigh",
      "weakAsyncVoiceStartFailureCountZero",
      "accountAsyncVoiceStartFailureCountZero",
      "weakDeleteRemoteFailureCountZero",
      "accountDeleteRemoteFailureCountZero",
    ]));
    const gateProbe = replayApi.runCp3ReplaySuiteGateProbe({
      clearAppEvents: true,
      captureWindowSize: 300,
    });
    expect(gateProbe.pass).toBe(false);
    expect(gateProbe.failedChecks).toEqual(expect.arrayContaining([
      "weakAsyncVoiceSummaryPresent",
      "accountAsyncVoiceSummaryPresent",
      "weakDeleteSummaryPresent",
      "accountDeleteSummaryPresent",
    ]));
  });

  it("exports deterministic long-session replay capture with CP4 readiness pass", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runLongSessionReplayCapture: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => {
        replay: {
          finalState: { phase: string };
          transitionEventCount: number;
          degradedTransitionCount: number;
          recoveredActiveTransitionCount: number;
          endedTransitionCount: number;
          latestDigestSummary: { recoveryExhaustedCount: number } | null;
        } | null;
        replayConfig: { cycleCount: number; injectRecoveryExhausted: boolean };
        cp4ReadinessGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, boolean>;
        };
      };
      runLongSessionReplayCaptureJson: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => string;
    };

    const bundle = replayApi.runLongSessionReplayCapture({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    });
    expect(bundle.replayConfig.cycleCount).toBe(5);
    expect(bundle.replayConfig.injectRecoveryExhausted).toBe(false);
    expect(bundle.replay?.finalState.phase).toBe("active");
    expect(bundle.replay?.transitionEventCount).toBeGreaterThanOrEqual(17);
    expect(bundle.replay?.degradedTransitionCount).toBeGreaterThanOrEqual(5);
    expect(bundle.replay?.recoveredActiveTransitionCount).toBeGreaterThanOrEqual(5);
    expect(bundle.replay?.endedTransitionCount).toBe(0);
    expect(bundle.replay?.latestDigestSummary?.recoveryExhaustedCount).toBe(0);
    expect(bundle.cp4ReadinessGate.pass).toBe(true);
    expect(bundle.cp4ReadinessGate.failedChecks).toEqual([]);
    expect(bundle.cp4ReadinessGate.checks.finalPhaseActive).toBe(true);
    expect(bundle.cp4ReadinessGate.checks.recoveredTransitionsSufficient).toBe(true);
    expect(bundle.cp4ReadinessGate.checks.endedTransitionsZero).toBe(true);
    const diagnosticsApi = root.obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const cp4Events = diagnosticsApi.findByName("messaging.realtime_voice.long_session_gate", 20);
    expect(cp4Events.length).toBeGreaterThanOrEqual(1);
    expect(cp4Events.at(-1)?.context).toEqual(expect.objectContaining({
      cp4Pass: true,
      injectRecoveryExhausted: false,
      finalPhase: "active",
    }));
    expect(() => JSON.parse(replayApi.runLongSessionReplayCaptureJson({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    }))).not.toThrow();
  });

  it("fails CP4 readiness gate when long-session replay exhausts recovery", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runLongSessionReplayCapture: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
        injectRecoveryExhausted?: boolean;
        maxRecoveryAttempts?: number;
      }) => {
        replay: {
          finalState: { phase: string; lastTransitionReasonCode: string };
          endedTransitionCount: number;
          latestDigestSummary: { recoveryExhaustedCount: number } | null;
        } | null;
        cp4ReadinessGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, boolean>;
        };
      };
    };

    const bundle = replayApi.runLongSessionReplayCapture({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 4,
      injectRecoveryExhausted: true,
      maxRecoveryAttempts: 2,
    });
    expect(bundle.replay?.finalState.phase).toBe("ended");
    expect(bundle.replay?.finalState.lastTransitionReasonCode).toBe("recovery_exhausted");
    expect(bundle.replay?.endedTransitionCount).toBeGreaterThanOrEqual(1);
    expect(bundle.replay?.latestDigestSummary?.recoveryExhaustedCount).toBeGreaterThanOrEqual(1);
    expect(bundle.cp4ReadinessGate.pass).toBe(false);
    expect(bundle.cp4ReadinessGate.failedChecks).toEqual(expect.arrayContaining([
      "finalPhaseActive",
      "endedTransitionsZero",
      "digestRecoveryExhaustedZero",
    ]));
    const diagnosticsApi = root.obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const cp4Events = diagnosticsApi.findByName("messaging.realtime_voice.long_session_gate", 20);
    expect(cp4Events.length).toBeGreaterThanOrEqual(1);
    expect(cp4Events.at(-1)?.context).toEqual(expect.objectContaining({
      cp4Pass: false,
      injectRecoveryExhausted: true,
      finalPhase: "ended",
      finalReasonCode: "recovery_exhausted",
    }));
  });

  it("captures connecting-timeout watchdog diagnostics with deterministic gate verdict", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const captureApi = root.obscurM6VoiceCapture as { capture: (eventWindowSize?: number) => unknown };
    captureApi.capture = () => ({
      generatedAtUnixMs: 10,
      version: "obscur.m6.voice.v1",
      source: { userAgent: "test", locationHref: "http://localhost/" },
      checks: { requiredApis: { appEvents: true, m0Triage: false } },
      voice: {
        summary: {
          riskLevel: "watch",
          connectTimeoutDiagnosticsCount: 1,
          connectTimeoutNoOpenRelayCount: 1,
          latestConnectTimeoutRtcConnectionState: "connecting",
          latestConnectTimeoutOpenRelayCount: 0,
        },
        asyncVoiceNoteSummary: null,
        deleteConvergenceSummary: null,
        transitions: [],
        ignoredEvents: [],
        connectTimeoutEvents: [{
          name: "messaging.realtime_voice.connect_timeout_diagnostics",
          atUnixMs: 99,
          level: "warn",
          context: {
            openRelayCount: 0,
            rtcConnectionState: "connecting",
          },
        }],
        longSessionGateEvents: [],
        checkpointGateEvents: [],
        releaseReadinessGateEvents: [],
        releaseEvidenceGateEvents: [],
        closeoutGateEvents: [],
        voiceNoteEvents: [],
        deleteConvergenceEvents: [],
        recentWarnOrError: [],
      },
      m0Triage: null,
    } as unknown);

    const replayApi = root.obscurM6VoiceReplay as {
      runConnectingWatchdogCapture: (params?: {
        captureWindowSize?: number;
        expectedNoOpenRelay?: boolean;
      }) => {
        captureWindowSize: number;
        expectedNoOpenRelay: boolean;
        connectTimeoutEvents: ReadonlyArray<{ name: string }>;
        digestSummary: {
          connectTimeoutDiagnosticsCount: number;
          connectTimeoutNoOpenRelayCount: number;
          latestConnectTimeoutOpenRelayCount: number | null;
        } | null;
        latestConnectTimeoutEventContext: Record<string, unknown> | null;
        watchdogGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, boolean>;
        };
      };
      runConnectingWatchdogCaptureJson: (params?: {
        captureWindowSize?: number;
        expectedNoOpenRelay?: boolean;
      }) => string;
      runConnectingWatchdogGateProbe: (params?: {
        captureWindowSize?: number;
        expectedNoOpenRelay?: boolean;
      }) => {
        pass: boolean;
        failedChecks: readonly string[];
        checks: Record<string, boolean>;
      };
      runConnectingWatchdogGateProbeJson: (params?: {
        captureWindowSize?: number;
        expectedNoOpenRelay?: boolean;
      }) => string;
    };

    const bundle = replayApi.runConnectingWatchdogCapture({
      captureWindowSize: 280,
      expectedNoOpenRelay: true,
    });
    expect(bundle.captureWindowSize).toBe(280);
    expect(bundle.expectedNoOpenRelay).toBe(true);
    expect(bundle.connectTimeoutEvents[0]?.name).toBe("messaging.realtime_voice.connect_timeout_diagnostics");
    expect(bundle.digestSummary?.connectTimeoutDiagnosticsCount).toBe(1);
    expect(bundle.digestSummary?.connectTimeoutNoOpenRelayCount).toBe(1);
    expect(bundle.digestSummary?.latestConnectTimeoutOpenRelayCount).toBe(0);
    expect(bundle.latestConnectTimeoutEventContext).toEqual(expect.objectContaining({
      openRelayCount: 0,
      rtcConnectionState: "connecting",
    }));
    expect(bundle.watchdogGate.pass).toBe(true);
    expect(bundle.watchdogGate.failedChecks).toEqual([]);
    expect(bundle.watchdogGate.checks.connectTimeoutEventsObserved).toBe(true);
    expect(bundle.watchdogGate.checks.noOpenRelayEvidenceObserved).toBe(true);
    expect(bundle.watchdogGate.checks.latestTimeoutOpenRelayAligned).toBe(true);
    expect(bundle.watchdogGate.checks.latestTimeoutRtcStateAligned).toBe(true);
    const diagnosticsApi = root.obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const gateEvents = diagnosticsApi.findByName("messaging.realtime_voice.connecting_watchdog_gate", 5);
    expect(gateEvents.length).toBeGreaterThanOrEqual(1);
    expect(gateEvents.at(-1)?.context).toEqual(expect.objectContaining({
      watchdogPass: true,
      expectedNoOpenRelay: true,
      connectTimeoutEventCount: 1,
      digestConnectTimeoutDiagnosticsCount: 1,
      digestConnectTimeoutNoOpenRelayCount: 1,
      latestTimeoutOpenRelayCount: 0,
      latestTimeoutRtcConnectionState: "connecting",
      latestEventOpenRelayCount: 0,
      latestEventRtcConnectionState: "connecting",
    }));
    expect(() => JSON.parse(replayApi.runConnectingWatchdogCaptureJson({
      captureWindowSize: 280,
      expectedNoOpenRelay: true,
    }))).not.toThrow();
    const gate = replayApi.runConnectingWatchdogGateProbe({
      captureWindowSize: 280,
      expectedNoOpenRelay: true,
    });
    expect(gate.pass).toBe(true);
    expect(gate.failedChecks).toEqual([]);
    expect(() => JSON.parse(replayApi.runConnectingWatchdogGateProbeJson({
      captureWindowSize: 280,
      expectedNoOpenRelay: true,
    }))).not.toThrow();
  });

  it("exports deterministic connecting watchdog self-test report", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runConnectingWatchdogSelfTest: (params?: { clearAppEvents?: boolean; captureWindowSize?: number }) => {
        noOpenRelayExpected: {
          watchdogGate: { pass: boolean; checks: Record<string, boolean> };
          connectTimeoutEvents: ReadonlyArray<{ name: string }>;
        };
        openRelayUnexpected: {
          watchdogGate: { pass: boolean; failedChecks: ReadonlyArray<string> };
          connectTimeoutEvents: ReadonlyArray<{ name: string }>;
        };
        selfTestGate: {
          pass: boolean;
          failedChecks: ReadonlyArray<string>;
          checks: Record<string, boolean>;
        };
      };
      runConnectingWatchdogSelfTestJson: (params?: { clearAppEvents?: boolean; captureWindowSize?: number }) => string;
    };

    const report = replayApi.runConnectingWatchdogSelfTest({
      clearAppEvents: true,
      captureWindowSize: 260,
    });
    expect(report.noOpenRelayExpected.watchdogGate.pass).toBe(true);
    expect(report.noOpenRelayExpected.watchdogGate.checks.noOpenRelayEvidenceObserved).toBe(true);
    expect(report.noOpenRelayExpected.connectTimeoutEvents[0]?.name).toBe("messaging.realtime_voice.connect_timeout_diagnostics");
    expect(report.openRelayUnexpected.watchdogGate.pass).toBe(false);
    expect(report.openRelayUnexpected.watchdogGate.failedChecks).toContain("noOpenRelayEvidenceObserved");
    expect(report.openRelayUnexpected.connectTimeoutEvents[0]?.name).toBe("messaging.realtime_voice.connect_timeout_diagnostics");
    expect(report.selfTestGate.pass).toBe(true);
    expect(report.selfTestGate.failedChecks).toEqual([]);
    expect(report.selfTestGate.checks.failureFlagsNoOpenRelayEvidence).toBe(true);
    const diagnosticsApi = root.obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const selfTestEvents = diagnosticsApi.findByName("messaging.realtime_voice.connecting_watchdog_self_test", 5);
    expect(selfTestEvents.length).toBeGreaterThanOrEqual(1);
    expect(selfTestEvents.at(-1)?.context).toEqual(expect.objectContaining({
      selfTestPass: true,
      nominalPass: true,
      failureRejected: true,
      failureFlagsNoOpenRelayEvidence: true,
      timeoutEventsObservedInBothScenarios: true,
      nominalWatchdogGatePass: true,
      failureWatchdogGatePass: false,
    }));
    expect(() => JSON.parse(replayApi.runConnectingWatchdogSelfTestJson({
      clearAppEvents: true,
      captureWindowSize: 260,
    }))).not.toThrow();
  });

  it("exports deterministic connecting watchdog incident bundle with gate verdict", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    (root as unknown as {
      obscurM0Triage: { capture: (eventWindowSize?: number) => unknown };
    }).obscurM0Triage = {
      capture: () => ({ tag: "m0-triage" }),
    };
    const replayApi = root.obscurM6VoiceReplay as {
      runConnectingWatchdogIncidentBundle: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        expectedNoOpenRelay?: boolean;
      }) => {
        captureWindowSize: number;
        expectedNoOpenRelay: boolean;
        watchdogCapture: {
          watchdogGate: { pass: boolean };
          connectTimeoutEvents: ReadonlyArray<{ name: string }>;
        };
        selfTest: {
          selfTestGate: { pass: boolean; checks: Record<string, boolean> };
        };
        m0Triage: unknown;
        incidentGate: {
          pass: boolean;
          failedChecks: ReadonlyArray<string>;
          checks: Record<string, boolean>;
        };
      };
      runConnectingWatchdogIncidentBundleJson: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        expectedNoOpenRelay?: boolean;
      }) => string;
    };

    const bundle = replayApi.runConnectingWatchdogIncidentBundle({
      clearAppEvents: true,
      captureWindowSize: 280,
      expectedNoOpenRelay: true,
    });
    expect(bundle.captureWindowSize).toBe(280);
    expect(bundle.expectedNoOpenRelay).toBe(true);
    expect(bundle.watchdogCapture.watchdogGate.pass).toBe(true);
    expect(bundle.watchdogCapture.connectTimeoutEvents[0]?.name).toBe("messaging.realtime_voice.connect_timeout_diagnostics");
    expect(bundle.selfTest.selfTestGate.pass).toBe(true);
    expect(bundle.selfTest.selfTestGate.checks.failureFlagsNoOpenRelayEvidence).toBe(true);
    expect(bundle.m0Triage).toEqual({ tag: "m0-triage" });
    expect(bundle.incidentGate.pass).toBe(true);
    expect(bundle.incidentGate.failedChecks).toEqual([]);
    expect(bundle.incidentGate.checks.watchdogCapturePass).toBe(true);
    expect(bundle.incidentGate.checks.selfTestPass).toBe(true);
    expect(bundle.incidentGate.checks.m0TriageCapturedWhenRequested).toBe(true);
    const diagnosticsApi = root.obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const incidentEvents = diagnosticsApi.findByName("messaging.realtime_voice.connecting_watchdog_incident_bundle", 5);
    expect(incidentEvents.length).toBeGreaterThanOrEqual(1);
    expect(incidentEvents.at(-1)?.context).toEqual(expect.objectContaining({
      incidentPass: true,
      watchdogCapturePass: true,
      selfTestPass: true,
      captureAndSelfTestAligned: true,
      m0TriageCapturedWhenRequested: true,
      expectedNoOpenRelay: true,
      includeM0Triage: true,
    }));
    expect(() => JSON.parse(replayApi.runConnectingWatchdogIncidentBundleJson({
      clearAppEvents: true,
      captureWindowSize: 280,
      expectedNoOpenRelay: true,
    }))).not.toThrow();
  });

  it("exports deterministic CP4 long-session gate probe with nominal pass", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp4LongSessionGateProbe: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => {
        pass: boolean;
        failedChecks: readonly string[];
        checks: Record<string, boolean>;
      };
      runCp4LongSessionGateProbeJson: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => string;
    };

    const probe = replayApi.runCp4LongSessionGateProbe({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    });
    expect(probe.pass).toBe(true);
    expect(probe.failedChecks).toEqual([]);
    expect(probe.checks.gateMatchesExpectedPass).toBe(true);
    expect(probe.checks.latestGateEventPresent).toBe(true);
    expect(probe.checks.latestGateEventMatchesExpectedPass).toBe(true);
    expect(() => JSON.parse(replayApi.runCp4LongSessionGateProbeJson({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    }))).not.toThrow();
  });

  it("passes CP4 long-session gate probe when failure-injection replay is expected to fail", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp4LongSessionGateProbe: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
        maxRecoveryAttempts?: number;
        injectRecoveryExhausted?: boolean;
        expectedPass?: boolean;
      }) => {
        pass: boolean;
        failedChecks: readonly string[];
        checks: Record<string, boolean>;
      };
    };

    const probe = replayApi.runCp4LongSessionGateProbe({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 4,
      maxRecoveryAttempts: 2,
      injectRecoveryExhausted: true,
      expectedPass: false,
    });
    expect(probe.pass).toBe(true);
    expect(probe.failedChecks).toEqual([]);
    expect(probe.checks.gateMatchesExpectedPass).toBe(true);
    expect(probe.checks.latestGateEventMatchesExpectedPass).toBe(true);
    expect(probe.checks.latestGateEventFailureSampleAligned).toBe(true);
    expect(probe.checks.finalPhaseAlignedWithExpectedPass).toBe(true);
  });

  it("exports deterministic CP4 checkpoint capture bundle with aggregate pass verdict", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp4CheckpointCapture: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => {
        longSession: { cp4ReadinessGate: { pass: boolean } };
        gateProbe: { pass: boolean };
        selfTest: { selfTestGate: { pass: boolean } };
        digestSummary: { riskLevel: "none" | "watch" | "high"; unexpectedLongSessionGateFailCount: number } | null;
        cp4CheckpointGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, boolean>;
        };
      };
      runCp4CheckpointCaptureJson: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => string;
    };

    const checkpoint = replayApi.runCp4CheckpointCapture({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    });
    expect(checkpoint.longSession.cp4ReadinessGate.pass).toBe(true);
    expect(checkpoint.gateProbe.pass).toBe(true);
    expect(checkpoint.selfTest.selfTestGate.pass).toBe(true);
    expect(checkpoint.digestSummary?.riskLevel).not.toBe("high");
    expect(checkpoint.digestSummary?.unexpectedLongSessionGateFailCount).toBe(0);
    expect(checkpoint.cp4CheckpointGate.pass).toBe(true);
    expect(checkpoint.cp4CheckpointGate.failedChecks).toEqual([]);
    const diagnosticsApi = root.obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const checkpointEvents = diagnosticsApi.findByName("messaging.realtime_voice.cp4_checkpoint_gate", 5);
    expect(checkpointEvents.length).toBeGreaterThanOrEqual(1);
    expect(checkpointEvents.at(-1)?.context).toEqual(expect.objectContaining({
      cp4CheckpointPass: true,
      expectedPass: true,
      longSessionGatePass: true,
      gateProbePass: true,
      selfTestGatePass: true,
    }));
    expect(() => JSON.parse(replayApi.runCp4CheckpointCaptureJson({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    }))).not.toThrow();
  });

  it("fails CP4 checkpoint gate when long-session replay is recovery-exhausted", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp4CheckpointCapture: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
        maxRecoveryAttempts?: number;
        injectRecoveryExhausted?: boolean;
      }) => {
        cp4CheckpointGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, boolean>;
        };
      };
    };

    const checkpoint = replayApi.runCp4CheckpointCapture({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 4,
      maxRecoveryAttempts: 2,
      injectRecoveryExhausted: true,
    });
    expect(checkpoint.cp4CheckpointGate.pass).toBe(false);
    expect(checkpoint.cp4CheckpointGate.failedChecks).toEqual(expect.arrayContaining([
      "longSessionGatePass",
    ]));
  });

  it("exports deterministic CP4 checkpoint gate probe with nominal pass", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp4CheckpointGateProbe: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => {
        pass: boolean;
        failedChecks: readonly string[];
        checks: Record<string, boolean>;
      };
      runCp4CheckpointGateProbeJson: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => string;
    };

    const gate = replayApi.runCp4CheckpointGateProbe({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    });
    expect(gate.pass).toBe(true);
    expect(gate.failedChecks).toEqual([]);
    expect(gate.checks.longSessionGatePass).toBe(true);
    expect(gate.checks.gateProbePass).toBe(true);
    expect(gate.checks.selfTestGatePass).toBe(true);
    expect(() => JSON.parse(replayApi.runCp4CheckpointGateProbeJson({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    }))).not.toThrow();
  });

  it("fails CP4 checkpoint gate probe deterministically when capture summaries are unavailable", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp4CheckpointGateProbe: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => {
        pass: boolean;
        failedChecks: readonly string[];
        checks: Record<string, boolean>;
      };
    };

    const gate = replayApi.runCp4CheckpointGateProbe({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    });
    expect(gate.pass).toBe(false);
    expect(gate.failedChecks).toEqual(expect.arrayContaining([
      "longSessionGatePass",
      "gateProbePass",
      "selfTestGatePass",
    ]));
  });

  it("exports deterministic CP4 release-readiness capture with aligned event evidence", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp4ReleaseReadinessCapture: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => {
        releaseReadinessGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, boolean>;
        };
        latestCheckpointGateEventContext: Record<string, unknown> | null;
        digestSummary: { checkpointGateCount: number; latestCheckpointGatePass: boolean | null } | null;
      };
      runCp4ReleaseReadinessCaptureJson: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => string;
    };

    const bundle = replayApi.runCp4ReleaseReadinessCapture({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    });
    expect(bundle.releaseReadinessGate.pass).toBe(true);
    expect(bundle.releaseReadinessGate.failedChecks).toEqual([]);
    expect(bundle.releaseReadinessGate.checks.checkpointGateMatchesExpected).toBe(true);
    expect(bundle.releaseReadinessGate.checks.checkpointGateEventObserved).toBe(true);
    expect(bundle.releaseReadinessGate.checks.digestSummaryPresent).toBe(true);
    expect(bundle.releaseReadinessGate.checks.digestCheckpointGateCountObserved).toBe(true);
    expect(bundle.latestCheckpointGateEventContext?.cp4CheckpointPass).toBe(true);
    expect(bundle.digestSummary?.checkpointGateCount).toBeGreaterThanOrEqual(1);
    expect(bundle.digestSummary?.latestCheckpointGatePass).toBe(true);
    const diagnosticsApi = root.obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const readinessEvents = diagnosticsApi.findByName("messaging.realtime_voice.cp4_release_readiness_gate", 5);
    expect(readinessEvents.length).toBeGreaterThanOrEqual(1);
    expect(readinessEvents.at(-1)?.context).toEqual(expect.objectContaining({
      cp4ReleaseReadinessPass: true,
      expectedPass: true,
      checkpointGatePass: true,
      checkpointEventObserved: true,
    }));
    expect(() => JSON.parse(replayApi.runCp4ReleaseReadinessCaptureJson({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    }))).not.toThrow();
  });

  it("fails CP4 release-readiness gate probe when capture summaries are unavailable", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp4ReleaseReadinessGateProbe: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => {
        pass: boolean;
        failedChecks: readonly string[];
        checks: Record<string, boolean>;
      };
      runCp4ReleaseReadinessGateProbeJson: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => string;
    };

    const gate = replayApi.runCp4ReleaseReadinessGateProbe({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    });
    expect(gate.pass).toBe(false);
    expect(gate.failedChecks).toEqual(expect.arrayContaining([
      "checkpointGateMatchesExpected",
      "digestUnexpectedCheckpointFailZeroWhenExpectedPass",
    ]));
    expect(() => JSON.parse(replayApi.runCp4ReleaseReadinessGateProbeJson({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    }))).not.toThrow();
  });

  it("exports deterministic CP4 release-evidence packet with aligned event slices", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp4ReleaseEvidenceCapture: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
        eventSliceLimit?: number;
      }) => {
        evidenceGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, boolean>;
        };
        longSessionGateEventContexts: ReadonlyArray<Record<string, unknown>>;
        checkpointGateEventContexts: ReadonlyArray<Record<string, unknown>>;
        releaseReadinessGateEventContexts: ReadonlyArray<Record<string, unknown>>;
        recentWarnOrError: ReadonlyArray<{ name: string; level: string }>;
      };
      runCp4ReleaseEvidenceCaptureJson: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
        eventSliceLimit?: number;
      }) => string;
    };

    const evidence = replayApi.runCp4ReleaseEvidenceCapture({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
      eventSliceLimit: 2,
    });
    expect(evidence.evidenceGate.pass).toBe(true);
    expect(evidence.evidenceGate.failedChecks).toEqual([]);
    expect(evidence.evidenceGate.checks.releaseReadinessGateMatchesExpected).toBe(true);
    expect(evidence.longSessionGateEventContexts.length).toBeGreaterThanOrEqual(1);
    expect(evidence.checkpointGateEventContexts.length).toBeGreaterThanOrEqual(1);
    expect(evidence.releaseReadinessGateEventContexts.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(evidence.recentWarnOrError)).toBe(true);
    const diagnosticsApi = root.obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const releaseEvidenceEvents = diagnosticsApi.findByName("messaging.realtime_voice.cp4_release_evidence_gate", 5);
    expect(releaseEvidenceEvents.length).toBeGreaterThanOrEqual(1);
    expect(releaseEvidenceEvents.at(-1)?.context).toEqual(expect.objectContaining({
      cp4ReleaseEvidencePass: true,
      expectedPass: true,
      releaseReadinessGatePass: true,
    }));
    expect(() => JSON.parse(replayApi.runCp4ReleaseEvidenceCaptureJson({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
      eventSliceLimit: 2,
    }))).not.toThrow();
  });

  it("fails CP4 release-evidence gate probe deterministically when capture summaries are unavailable", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp4ReleaseEvidenceGateProbe: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => {
        pass: boolean;
        failedChecks: readonly string[];
        checks: Record<string, boolean>;
      };
      runCp4ReleaseEvidenceGateProbeJson: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => string;
    };

    const gate = replayApi.runCp4ReleaseEvidenceGateProbe({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    });
    expect(gate.pass).toBe(false);
    expect(gate.failedChecks).toEqual(expect.arrayContaining([
      "releaseReadinessGateMatchesExpected",
    ]));
    expect(() => JSON.parse(replayApi.runCp4ReleaseEvidenceGateProbeJson({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    }))).not.toThrow();
  });

  it("exports deterministic v1.2.0 closeout capture bundle with aggregate pass verdict", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runV120CloseoutCapture: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
        eventSliceLimit?: number;
      }) => {
        cp3Suite: {
          suiteGate: { pass: boolean };
          weakNetwork: { cp2EvidenceGate: { pass: boolean } };
          accountSwitch: { cp2EvidenceGate: { pass: boolean } };
        };
        cp4ReleaseEvidence: {
          evidenceGate: { pass: boolean };
          releaseReadiness: {
            releaseReadinessGate: { pass: boolean };
            checkpoint: { cp4CheckpointGate: { pass: boolean } };
          };
        };
        closeoutGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, boolean>;
        };
      };
      runV120CloseoutCaptureJson: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
        eventSliceLimit?: number;
      }) => string;
      runV120CloseoutGateProbe: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
        eventSliceLimit?: number;
      }) => {
        pass: boolean;
        failedChecks: readonly string[];
        checks: Record<string, boolean>;
      };
      runV120CloseoutGateProbeJson: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
        eventSliceLimit?: number;
      }) => string;
    };

    const closeout = replayApi.runV120CloseoutCapture({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
      eventSliceLimit: 2,
    });
    expect(closeout.cp3Suite.suiteGate.pass).toBe(true);
    expect(closeout.cp3Suite.weakNetwork.cp2EvidenceGate.pass).toBe(true);
    expect(closeout.cp3Suite.accountSwitch.cp2EvidenceGate.pass).toBe(true);
    expect(closeout.cp4ReleaseEvidence.evidenceGate.pass).toBe(true);
    expect(closeout.cp4ReleaseEvidence.releaseReadiness.releaseReadinessGate.pass).toBe(true);
    expect(closeout.cp4ReleaseEvidence.releaseReadiness.checkpoint.cp4CheckpointGate.pass).toBe(true);
    expect(closeout.closeoutGate.pass).toBe(true);
    expect(closeout.closeoutGate.failedChecks).toEqual([]);
    expect(closeout.closeoutGate.checks.cp3SuiteGatePass).toBe(true);
    expect(closeout.closeoutGate.checks.cp4ReleaseEvidenceGateMatchesExpected).toBe(true);
    expect(closeout.closeoutGate.checks.digestRiskNotHighWhenExpectedPass).toBe(true);
    const diagnosticsApi = root.obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const closeoutEvents = diagnosticsApi.findByName("messaging.realtime_voice.v120_closeout_gate", 5);
    expect(closeoutEvents.length).toBeGreaterThanOrEqual(1);
    expect(closeoutEvents.at(-1)?.context).toEqual(expect.objectContaining({
      closeoutPass: true,
      expectedPass: true,
      cp3SuitePass: true,
      cp4ReleaseEvidencePass: true,
      cp4ReleaseReadinessPass: true,
      cp4CheckpointPass: true,
    }));
    expect(() => JSON.parse(replayApi.runV120CloseoutCaptureJson({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
      eventSliceLimit: 2,
    }))).not.toThrow();
    const gate = replayApi.runV120CloseoutGateProbe({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
      eventSliceLimit: 2,
    });
    expect(gate.pass).toBe(true);
    expect(gate.failedChecks).toEqual([]);
    expect(() => JSON.parse(replayApi.runV120CloseoutGateProbeJson({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
      eventSliceLimit: 2,
    }))).not.toThrow();
  });

  it("fails v1.2.0 closeout gate deterministically when capture summaries are unavailable", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runV120CloseoutGateProbe: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => {
        pass: boolean;
        failedChecks: readonly string[];
        checks: Record<string, boolean>;
      };
    };

    const gate = replayApi.runV120CloseoutGateProbe({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 5,
    });
    expect(gate.pass).toBe(false);
    expect(gate.failedChecks).toEqual(expect.arrayContaining([
      "cp3SuiteGatePass",
      "cp4ReleaseEvidenceGateMatchesExpected",
      "weakDeleteSummaryPresent",
      "accountDeleteSummaryPresent",
    ]));
  });

  it("exports deterministic CP4 long-session self-test report with compact pass/fail verdict", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp4LongSessionSelfTest: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => {
        nominal: {
          cp4ReadinessGate: { pass: boolean };
          replay: { finalState: { phase: string } } | null;
        };
        failureInjection: {
          cp4ReadinessGate: { pass: boolean };
          replay: { finalState: { phase: string; lastTransitionReasonCode: string } } | null;
        };
        selfTestGate: {
          pass: boolean;
          failedChecks: readonly string[];
          checks: Record<string, boolean>;
        };
      };
      runCp4LongSessionSelfTestJson: (params?: {
        clearAppEvents?: boolean;
        captureWindowSize?: number;
        cycleCount?: number;
      }) => string;
    };

    const report = replayApi.runCp4LongSessionSelfTest({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 6,
    });
    expect(report.nominal.cp4ReadinessGate.pass).toBe(true);
    expect(report.nominal.replay?.finalState.phase).toBe("active");
    expect(report.failureInjection.cp4ReadinessGate.pass).toBe(false);
    expect(report.failureInjection.replay?.finalState.phase).toBe("ended");
    expect(report.failureInjection.replay?.finalState.lastTransitionReasonCode).toBe("recovery_exhausted");
    expect(report.selfTestGate.pass).toBe(true);
    expect(report.selfTestGate.failedChecks).toEqual([]);
    expect(report.selfTestGate.checks.nominalPass).toBe(true);
    expect(report.selfTestGate.checks.failureGateRejected).toBe(true);
    expect(() => JSON.parse(replayApi.runCp4LongSessionSelfTestJson({
      clearAppEvents: true,
      captureWindowSize: 300,
      cycleCount: 6,
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

  it("exports deterministic single-device CP3 self-test report without extra accounts", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installM6VoiceCapture();
    installM6VoiceReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM6VoiceReplay as {
      runCp3SingleDeviceSelfTest: (params?: { clearAppEvents?: boolean; captureWindowSize?: number }) => {
        suite: {
          suiteGate: { pass: boolean };
          weakNetwork: { cp2EvidenceGate: { pass: boolean } };
          accountSwitch: { cp2EvidenceGate: { pass: boolean } };
        };
        unsupportedProbe: { pass: boolean; checks: Record<string, boolean> };
        recoveryExhaustedProbe: { pass: boolean; checks: Record<string, boolean> };
        selfTestGate: { pass: boolean; failedChecks: readonly string[]; checks: Record<string, boolean> };
      };
      runCp3SingleDeviceSelfTestJson: (params?: { clearAppEvents?: boolean; captureWindowSize?: number }) => string;
    };

    const report = replayApi.runCp3SingleDeviceSelfTest({
      clearAppEvents: true,
      captureWindowSize: 300,
    });
    expect(report.suite.suiteGate.pass).toBe(true);
    expect(report.suite.weakNetwork.cp2EvidenceGate.pass).toBe(true);
    expect(report.suite.accountSwitch.cp2EvidenceGate.pass).toBe(true);
    expect(report.unsupportedProbe.pass).toBe(true);
    expect(report.unsupportedProbe.checks.finalPhaseUnsupported).toBe(true);
    expect(report.recoveryExhaustedProbe.pass).toBe(true);
    expect(report.recoveryExhaustedProbe.checks.finalReasonRecoveryExhausted).toBe(true);
    expect(report.selfTestGate.pass).toBe(true);
    expect(report.selfTestGate.failedChecks).toEqual([]);
    expect(() => JSON.parse(replayApi.runCp3SingleDeviceSelfTestJson({
      clearAppEvents: true,
      captureWindowSize: 300,
    }))).not.toThrow();
  });

  it("upgrades stale replay bridge object so newly added CP4 helpers are available", () => {
    const root = getMutableWindow();
    (root as unknown as { obscurM6VoiceReplay: unknown }).obscurM6VoiceReplay = {
      reset: () => ({ phase: "idle" }),
      getState: () => ({ phase: "idle" }),
      getLastReplay: () => null,
      runWeakNetworkReplay: () => ({ phase: "active" }),
    };

    installM6VoiceReplayBridge();

    const upgraded = root.obscurM6VoiceReplay as Record<string, unknown> | undefined;
    expect(upgraded).toBeTruthy();
    expect(typeof upgraded?.runLongSessionReplayCapture).toBe("function");
    expect(typeof upgraded?.runCp4CheckpointCapture).toBe("function");
    expect(typeof upgraded?.runCp4CheckpointCaptureJson).toBe("function");
    expect(typeof upgraded?.runCp4CheckpointGateProbe).toBe("function");
    expect(typeof upgraded?.runCp4CheckpointGateProbeJson).toBe("function");
    expect(typeof upgraded?.runCp4ReleaseReadinessCapture).toBe("function");
    expect(typeof upgraded?.runCp4ReleaseReadinessCaptureJson).toBe("function");
    expect(typeof upgraded?.runCp4ReleaseReadinessGateProbe).toBe("function");
    expect(typeof upgraded?.runCp4ReleaseReadinessGateProbeJson).toBe("function");
    expect(typeof upgraded?.runCp4ReleaseEvidenceCapture).toBe("function");
    expect(typeof upgraded?.runCp4ReleaseEvidenceCaptureJson).toBe("function");
    expect(typeof upgraded?.runCp4ReleaseEvidenceGateProbe).toBe("function");
    expect(typeof upgraded?.runCp4ReleaseEvidenceGateProbeJson).toBe("function");
    expect(typeof upgraded?.runV120CloseoutCapture).toBe("function");
    expect(typeof upgraded?.runV120CloseoutCaptureJson).toBe("function");
    expect(typeof upgraded?.runV120CloseoutGateProbe).toBe("function");
    expect(typeof upgraded?.runV120CloseoutGateProbeJson).toBe("function");
    expect(typeof upgraded?.runCp4LongSessionGateProbe).toBe("function");
    expect(typeof upgraded?.runCp4LongSessionGateProbeJson).toBe("function");
    expect(typeof upgraded?.runCp4LongSessionSelfTest).toBe("function");
    expect(typeof upgraded?.runConnectingWatchdogCapture).toBe("function");
    expect(typeof upgraded?.runConnectingWatchdogCaptureJson).toBe("function");
    expect(typeof upgraded?.runConnectingWatchdogGateProbe).toBe("function");
    expect(typeof upgraded?.runConnectingWatchdogGateProbeJson).toBe("function");
    expect(typeof upgraded?.runConnectingWatchdogSelfTest).toBe("function");
    expect(typeof upgraded?.runConnectingWatchdogSelfTestJson).toBe("function");
    expect(typeof upgraded?.runConnectingWatchdogIncidentBundle).toBe("function");
    expect(typeof upgraded?.runConnectingWatchdogIncidentBundleJson).toBe("function");
  });
});
