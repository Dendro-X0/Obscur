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
            staleEventIgnoredCount: 1,
            connectTimeoutDiagnosticsCount: 2,
            connectTimeoutNoOpenRelayCount: 1,
            connectingWatchdogGateCount: 1,
            connectingWatchdogGatePassCount: 1,
            connectingWatchdogGateFailCount: 0,
            unexpectedConnectingWatchdogGateFailCount: 0,
            longSessionGateCount: 2,
            longSessionGatePassCount: 1,
            longSessionGateFailCount: 1,
            unexpectedLongSessionGateFailCount: 0,
            checkpointGateCount: 1,
            checkpointGatePassCount: 1,
            checkpointGateFailCount: 0,
            unexpectedCheckpointGateFailCount: 0,
            releaseReadinessGateCount: 1,
            releaseReadinessGatePassCount: 1,
            releaseReadinessGateFailCount: 0,
            unexpectedReleaseReadinessGateFailCount: 0,
            releaseEvidenceGateCount: 1,
            releaseEvidenceGatePassCount: 1,
            releaseEvidenceGateFailCount: 0,
            unexpectedReleaseEvidenceGateFailCount: 0,
            closeoutGateCount: 1,
            closeoutGatePassCount: 1,
            closeoutGateFailCount: 0,
            unexpectedCloseoutGateFailCount: 0,
            latestToPhase: "degraded",
            latestReasonCode: "network_degraded",
            latestIgnoredReasonCode: "stale_event",
            latestConnectTimeoutRtcConnectionState: "connecting",
            latestConnectTimeoutOpenRelayCount: 0,
            latestConnectingWatchdogGatePass: true,
            latestConnectingWatchdogGateFailedCheckSample: null,
            latestLongSessionGatePass: false,
            latestLongSessionGateFailedCheckSample: "finalPhaseActive",
            latestCheckpointGatePass: true,
            latestCheckpointGateFailedCheckSample: null,
            latestReleaseReadinessGatePass: true,
            latestReleaseReadinessGateFailedCheckSample: null,
            latestReleaseEvidenceGatePass: true,
            latestReleaseEvidenceGateFailedCheckSample: null,
            latestCloseoutGatePass: true,
            latestCloseoutGateFailedCheckSample: null,
          },
          asyncVoiceNote: {
            riskLevel: "watch",
            recordingCompleteCount: 2,
            recordingUnsupportedCount: 1,
            recordingStartFailedCount: 0,
            recordingEmptyCount: 1,
            latestReasonCode: "voice_note_empty_blob",
          },
          deleteConvergence: {
            riskLevel: "watch",
            requestedCount: 2,
            localAppliedCount: 2,
            remoteConfirmedCount: 1,
            remoteQueuedCount: 1,
            remoteFailedCount: 0,
            rejectedCount: 0,
            latestChannel: "dm",
            latestResultCode: "queued_retrying",
            latestReasonCode: "dm_delete_command_queued_retrying",
          },
        },
        recentWarnOrError: [{
          name: "messaging.realtime_voice.session_transition",
          level: "warn",
          atUnixMs: 42,
          reasonCode: "network_degraded",
        }],
      }),
      findByName: (name: string) => {
        if (name === "messaging.voice_note.recording_complete") {
          return [{ name, atUnixMs: 40, level: "info" }];
        }
        if (name === "messaging.voice_note.recording_start_failed") {
          return [{ name, atUnixMs: 41, level: "warn" }];
        }
        if (name === "messaging.delete_for_everyone_requested") {
          return [{ name, atUnixMs: 42, level: "info" }];
        }
        if (name === "messaging.delete_for_everyone_remote_result") {
          return [{ name, atUnixMs: 44, level: "warn" }];
        }
        return [{ name, atUnixMs: 43, level: "warn" }];
      },
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
        asyncVoiceNoteSummary: Record<string, unknown> | null;
        deleteConvergenceSummary: Record<string, unknown> | null;
        transitions: Array<{ name: string }>;
        ignoredEvents: Array<{ name: string }>;
        connectTimeoutEvents: Array<{ name: string }>;
        connectingWatchdogGateEvents: Array<{ name: string }>;
        longSessionGateEvents: Array<{ name: string }>;
        checkpointGateEvents: Array<{ name: string }>;
        releaseReadinessGateEvents: Array<{ name: string }>;
        releaseEvidenceGateEvents: Array<{ name: string }>;
        closeoutGateEvents: Array<{ name: string }>;
        voiceNoteEvents: Array<{ name: string }>;
        deleteConvergenceEvents: Array<{ name: string }>;
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
      staleEventIgnoredCount: 1,
      connectTimeoutDiagnosticsCount: 2,
      connectTimeoutNoOpenRelayCount: 1,
      connectingWatchdogGateCount: 1,
      connectingWatchdogGatePassCount: 1,
      connectingWatchdogGateFailCount: 0,
      unexpectedConnectingWatchdogGateFailCount: 0,
      longSessionGateCount: 2,
      longSessionGatePassCount: 1,
      longSessionGateFailCount: 1,
      unexpectedLongSessionGateFailCount: 0,
      checkpointGateCount: 1,
      checkpointGatePassCount: 1,
      checkpointGateFailCount: 0,
      unexpectedCheckpointGateFailCount: 0,
      releaseReadinessGateCount: 1,
      releaseReadinessGatePassCount: 1,
      releaseReadinessGateFailCount: 0,
      unexpectedReleaseReadinessGateFailCount: 0,
      releaseEvidenceGateCount: 1,
      releaseEvidenceGatePassCount: 1,
      releaseEvidenceGateFailCount: 0,
      unexpectedReleaseEvidenceGateFailCount: 0,
      closeoutGateCount: 1,
      closeoutGatePassCount: 1,
      closeoutGateFailCount: 0,
      unexpectedCloseoutGateFailCount: 0,
      latestReasonCode: "network_degraded",
      latestIgnoredReasonCode: "stale_event",
      latestConnectTimeoutRtcConnectionState: "connecting",
      latestConnectTimeoutOpenRelayCount: 0,
      latestConnectingWatchdogGatePass: true,
      latestConnectingWatchdogGateFailedCheckSample: null,
      latestLongSessionGatePass: false,
      latestLongSessionGateFailedCheckSample: "finalPhaseActive",
      latestCheckpointGatePass: true,
      latestCheckpointGateFailedCheckSample: null,
      latestReleaseReadinessGatePass: true,
      latestReleaseReadinessGateFailedCheckSample: null,
      latestReleaseEvidenceGatePass: true,
      latestReleaseEvidenceGateFailedCheckSample: null,
      latestCloseoutGatePass: true,
      latestCloseoutGateFailedCheckSample: null,
    }));
    expect(bundle.voice.asyncVoiceNoteSummary).toEqual(expect.objectContaining({
      riskLevel: "watch",
      recordingCompleteCount: 2,
      recordingUnsupportedCount: 1,
      recordingEmptyCount: 1,
      latestReasonCode: "voice_note_empty_blob",
    }));
    expect(bundle.voice.deleteConvergenceSummary).toEqual(expect.objectContaining({
      riskLevel: "watch",
      requestedCount: 2,
      localAppliedCount: 2,
      remoteConfirmedCount: 1,
      remoteQueuedCount: 1,
      remoteFailedCount: 0,
      latestChannel: "dm",
      latestResultCode: "queued_retrying",
      latestReasonCode: "dm_delete_command_queued_retrying",
    }));
    expect(bundle.voice.transitions[0]?.name).toBe("messaging.realtime_voice.session_transition");
    expect(bundle.voice.ignoredEvents[0]?.name).toBe("messaging.realtime_voice.session_event_ignored");
    expect(bundle.voice.connectTimeoutEvents[0]?.name).toBe("messaging.realtime_voice.connect_timeout_diagnostics");
    expect(bundle.voice.connectingWatchdogGateEvents[0]?.name).toBe("messaging.realtime_voice.connecting_watchdog_gate");
    expect(bundle.voice.longSessionGateEvents[0]?.name).toBe("messaging.realtime_voice.long_session_gate");
    expect(bundle.voice.checkpointGateEvents[0]?.name).toBe("messaging.realtime_voice.cp4_checkpoint_gate");
    expect(bundle.voice.releaseReadinessGateEvents[0]?.name).toBe("messaging.realtime_voice.cp4_release_readiness_gate");
    expect(bundle.voice.releaseEvidenceGateEvents[0]?.name).toBe("messaging.realtime_voice.cp4_release_evidence_gate");
    expect(bundle.voice.closeoutGateEvents[0]?.name).toBe("messaging.realtime_voice.v120_closeout_gate");
    expect(bundle.voice.voiceNoteEvents.some((event) => event.name === "messaging.voice_note.recording_complete")).toBe(true);
    expect(bundle.voice.voiceNoteEvents.some((event) => event.name === "messaging.voice_note.recording_start_failed")).toBe(true);
    expect(bundle.voice.deleteConvergenceEvents.some((event) => event.name === "messaging.delete_for_everyone_requested")).toBe(true);
    expect(bundle.voice.deleteConvergenceEvents.some((event) => event.name === "messaging.delete_for_everyone_remote_result")).toBe(true);
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
        asyncVoiceNoteSummary: unknown;
        deleteConvergenceSummary: unknown;
        transitions: unknown[];
        ignoredEvents: unknown[];
        connectTimeoutEvents: unknown[];
        connectingWatchdogGateEvents: unknown[];
        longSessionGateEvents: unknown[];
        checkpointGateEvents: unknown[];
        releaseReadinessGateEvents: unknown[];
        releaseEvidenceGateEvents: unknown[];
        closeoutGateEvents: unknown[];
        voiceNoteEvents: unknown[];
        deleteConvergenceEvents: unknown[];
        recentWarnOrError: unknown[];
      };
      m0Triage: unknown;
    };

    expect(bundle.checks.requiredApis.appEvents).toBe(false);
    expect(bundle.checks.requiredApis.m0Triage).toBe(false);
    expect(bundle.voice.summary).toBeNull();
    expect(bundle.voice.asyncVoiceNoteSummary).toBeNull();
    expect(bundle.voice.deleteConvergenceSummary).toBeNull();
    expect(bundle.voice.transitions).toEqual([]);
    expect(bundle.voice.ignoredEvents).toEqual([]);
    expect(bundle.voice.connectTimeoutEvents).toEqual([]);
    expect(bundle.voice.connectingWatchdogGateEvents).toEqual([]);
    expect(bundle.voice.longSessionGateEvents).toEqual([]);
    expect(bundle.voice.checkpointGateEvents).toEqual([]);
    expect(bundle.voice.releaseReadinessGateEvents).toEqual([]);
    expect(bundle.voice.releaseEvidenceGateEvents).toEqual([]);
    expect(bundle.voice.closeoutGateEvents).toEqual([]);
    expect(bundle.voice.voiceNoteEvents).toEqual([]);
    expect(bundle.voice.deleteConvergenceEvents).toEqual([]);
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
      staleEventIgnoredCount: 2,
      connectTimeoutDiagnosticsCount: 3,
      connectTimeoutNoOpenRelayCount: 1,
      connectingWatchdogGateCount: 2,
      connectingWatchdogGatePassCount: 1,
      connectingWatchdogGateFailCount: 1,
      unexpectedConnectingWatchdogGateFailCount: 1,
      longSessionGateCount: 3,
      longSessionGatePassCount: 1,
      longSessionGateFailCount: 2,
      unexpectedLongSessionGateFailCount: 1,
      checkpointGateCount: 2,
      checkpointGatePassCount: 1,
      checkpointGateFailCount: 1,
      unexpectedCheckpointGateFailCount: 1,
      releaseReadinessGateCount: 2,
      releaseReadinessGatePassCount: 1,
      releaseReadinessGateFailCount: 1,
      unexpectedReleaseReadinessGateFailCount: 1,
      releaseEvidenceGateCount: 2,
      releaseEvidenceGatePassCount: 1,
      releaseEvidenceGateFailCount: 1,
      unexpectedReleaseEvidenceGateFailCount: 1,
      closeoutGateCount: 2,
      closeoutGatePassCount: 1,
      closeoutGateFailCount: 1,
      unexpectedCloseoutGateFailCount: 1,
      latestToPhase: "ended",
      latestReasonCode: "recovery_exhausted",
      latestIgnoredReasonCode: "stale_event",
      latestConnectTimeoutRtcConnectionState: "connecting",
      latestConnectTimeoutOpenRelayCount: 0,
      latestConnectingWatchdogGatePass: false,
      latestConnectingWatchdogGateFailedCheckSample: "noOpenRelayEvidenceObserved",
      latestLongSessionGatePass: false,
      latestLongSessionGateFailedCheckSample: "digestRecoveryExhaustedZero",
      latestCheckpointGatePass: false,
      latestCheckpointGateFailedCheckSample: "selfTestGatePass",
      latestReleaseReadinessGatePass: false,
      latestReleaseReadinessGateFailedCheckSample: "checkpointEventMatchesGatePass",
      latestReleaseEvidenceGatePass: false,
      latestReleaseEvidenceGateFailedCheckSample: "releaseReadinessEventObserved",
      latestCloseoutGatePass: false,
      latestCloseoutGateFailedCheckSample: "cp3SuiteGatePass",
    })).toEqual(expect.objectContaining({
      riskLevel: "high",
      transitionCount: 5,
      recoveryExhaustedCount: 1,
      staleEventIgnoredCount: 2,
      connectTimeoutDiagnosticsCount: 3,
      connectTimeoutNoOpenRelayCount: 1,
      connectingWatchdogGateCount: 2,
      connectingWatchdogGatePassCount: 1,
      connectingWatchdogGateFailCount: 1,
      unexpectedConnectingWatchdogGateFailCount: 1,
      longSessionGateCount: 3,
      longSessionGatePassCount: 1,
      longSessionGateFailCount: 2,
      unexpectedLongSessionGateFailCount: 1,
      checkpointGateCount: 2,
      checkpointGatePassCount: 1,
      checkpointGateFailCount: 1,
      unexpectedCheckpointGateFailCount: 1,
      releaseReadinessGateCount: 2,
      releaseReadinessGatePassCount: 1,
      releaseReadinessGateFailCount: 1,
      unexpectedReleaseReadinessGateFailCount: 1,
      releaseEvidenceGateCount: 2,
      releaseEvidenceGatePassCount: 1,
      releaseEvidenceGateFailCount: 1,
      unexpectedReleaseEvidenceGateFailCount: 1,
      closeoutGateCount: 2,
      closeoutGatePassCount: 1,
      closeoutGateFailCount: 1,
      unexpectedCloseoutGateFailCount: 1,
      latestReasonCode: "recovery_exhausted",
      latestIgnoredReasonCode: "stale_event",
      latestConnectTimeoutRtcConnectionState: "connecting",
      latestConnectTimeoutOpenRelayCount: 0,
      latestConnectingWatchdogGatePass: false,
      latestConnectingWatchdogGateFailedCheckSample: "noOpenRelayEvidenceObserved",
      latestLongSessionGatePass: false,
      latestLongSessionGateFailedCheckSample: "digestRecoveryExhaustedZero",
      latestCheckpointGatePass: false,
      latestCheckpointGateFailedCheckSample: "selfTestGatePass",
      latestReleaseReadinessGatePass: false,
      latestReleaseReadinessGateFailedCheckSample: "checkpointEventMatchesGatePass",
      latestReleaseEvidenceGatePass: false,
      latestReleaseEvidenceGateFailedCheckSample: "releaseReadinessEventObserved",
      latestCloseoutGatePass: false,
      latestCloseoutGateFailedCheckSample: "cp3SuiteGatePass",
    }));
    expect(m6VoiceCaptureInternals.parseAsyncVoiceNoteSummary({
      riskLevel: "watch",
      recordingCompleteCount: 2,
      recordingUnsupportedCount: 1,
      recordingStartFailedCount: 0,
      recordingEmptyCount: 1,
      latestReasonCode: "voice_note_empty_blob",
    })).toEqual(expect.objectContaining({
      riskLevel: "watch",
      recordingCompleteCount: 2,
      recordingUnsupportedCount: 1,
      recordingStartFailedCount: 0,
      recordingEmptyCount: 1,
      latestReasonCode: "voice_note_empty_blob",
    }));
    expect(m6VoiceCaptureInternals.parseDeleteConvergenceSummary({
      riskLevel: "watch",
      requestedCount: 2,
      localAppliedCount: 2,
      remoteConfirmedCount: 1,
      remoteQueuedCount: 1,
      remoteFailedCount: 0,
      rejectedCount: 0,
      latestChannel: "dm",
      latestResultCode: "queued_retrying",
      latestReasonCode: "dm_delete_command_queued_retrying",
    })).toEqual(expect.objectContaining({
      riskLevel: "watch",
      requestedCount: 2,
      remoteQueuedCount: 1,
      latestResultCode: "queued_retrying",
      latestReasonCode: "dm_delete_command_queued_retrying",
    }));
    expect(m6VoiceCaptureInternals.toNumericWindowSize(410.7)).toBe(410);
    expect(m6VoiceCaptureInternals.toNumericWindowSize(0)).toBe(1);
    expect(m6VoiceCaptureInternals.toNumericWindowSize(Number.NaN)).toBe(400);
  });
});
