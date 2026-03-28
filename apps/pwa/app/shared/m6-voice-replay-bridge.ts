import type { RealtimeVoiceUnsupportedReasonCode } from "@/app/features/messaging/services/realtime-voice-capability";
import {
  createInitialRealtimeVoiceSessionState,
  type RealtimeVoiceSessionMode,
  type RealtimeVoiceSessionState,
} from "@/app/features/messaging/services/realtime-voice-session-lifecycle";
import { createRealtimeVoiceSessionOwner } from "@/app/features/messaging/services/realtime-voice-session-owner";
import { logAppEvent } from "@/app/shared/log-app-event";
import type { M6VoiceCaptureBundle } from "@/app/shared/m6-voice-capture";

type M6WeakNetworkReplayParams = Readonly<{
  roomId?: string;
  mode?: RealtimeVoiceSessionMode;
  baseUnixMs?: number;
  maxRecoveryAttempts?: number;
  captureWindowSize?: number;
  clearAppEvents?: boolean;
}>;

type M6AccountSwitchReplayParams = Readonly<{
  firstRoomId?: string;
  secondRoomId?: string;
  mode?: RealtimeVoiceSessionMode;
  baseUnixMs?: number;
  maxRecoveryAttempts?: number;
  captureWindowSize?: number;
  clearAppEvents?: boolean;
}>;

type M6LongSessionReplayParams = Readonly<{
  roomId?: string;
  mode?: RealtimeVoiceSessionMode;
  baseUnixMs?: number;
  maxRecoveryAttempts?: number;
  cycleCount?: number;
  injectRecoveryExhausted?: boolean;
  captureWindowSize?: number;
  clearAppEvents?: boolean;
}>;

type M6Cp4LongSessionSelfTestParams = Readonly<{
  baseUnixMs?: number;
  captureWindowSize?: number;
  clearAppEvents?: boolean;
  mode?: RealtimeVoiceSessionMode;
  cycleCount?: number;
  maxRecoveryAttempts?: number;
  failureCycleCount?: number;
  failureMaxRecoveryAttempts?: number;
}>;

type M6Cp4LongSessionGateProbeParams = M6LongSessionReplayParams & Readonly<{
  expectedPass?: boolean;
}>;

type M6Cp4CheckpointCaptureParams = Readonly<{
  baseUnixMs?: number;
  captureWindowSize?: number;
  clearAppEvents?: boolean;
  mode?: RealtimeVoiceSessionMode;
  cycleCount?: number;
  maxRecoveryAttempts?: number;
  injectRecoveryExhausted?: boolean;
  expectedPass?: boolean;
  selfTestCycleCount?: number;
  selfTestFailureCycleCount?: number;
  selfTestFailureMaxRecoveryAttempts?: number;
}>;

type M6Cp4ReleaseEvidenceParams = M6Cp4CheckpointCaptureParams & Readonly<{
  eventSliceLimit?: number;
}>;

type M6V120CloseoutParams = M6Cp4ReleaseEvidenceParams;

type M6ConnectingWatchdogCaptureParams = Readonly<{
  captureWindowSize?: number;
  clearAppEvents?: boolean;
  expectedNoOpenRelay?: boolean;
}>;

type M6ConnectingWatchdogSelfTestParams = Readonly<{
  captureWindowSize?: number;
  clearAppEvents?: boolean;
}>;

type M6VoiceDigestSummary = NonNullable<M6VoiceCaptureBundle["voice"]["summary"]>;
type M6VoiceReplayScenario = "weak_network" | "account_switch";

type M6VoiceReplayResult = Readonly<{
  scenario: M6VoiceReplayScenario;
  generatedAtUnixMs: number;
  replayBaseUnixMs: number;
  finalState: RealtimeVoiceSessionState;
  transitionEventCount: number;
  degradedTransitionCount: number;
  recoveredActiveTransitionCount: number;
  endedTransitionCount: number;
  roomHintCount: number;
  ignoredEventCount: number;
  latestDigestSummary: M6VoiceDigestSummary | null;
  replayReadiness: Readonly<{
    scenario: M6VoiceReplayScenario;
    hasTransitionEvents: boolean;
    hasDegradedTransition: boolean;
    hasRecoveredActiveTransition: boolean;
    hasEndedTransition: boolean;
    hasMultiRoomEvidence: boolean;
    hasPostSwitchActiveTransition: boolean;
    digestHasTransitionCount: boolean;
    digestHasDegradedCount: boolean;
    digestHasIgnoredFieldCoverage: boolean;
    riskNotHigh: boolean;
    readyForCp2Evidence: boolean;
  }>;
}>;

type M6VoiceCp2EvidenceGate = Readonly<{
  pass: boolean;
  failedChecks: ReadonlyArray<string>;
  checks: Readonly<{
    scenario: M6VoiceReplayScenario;
    hasReplayResult: boolean;
    hasCaptureBundle: boolean;
    hasTransitionEvents: boolean;
    hasDegradedTransition: boolean;
    hasRecoveredActiveTransition: boolean;
    hasEndedTransition: boolean;
    hasMultiRoomEvidence: boolean;
    hasPostSwitchActiveTransition: boolean;
    hasIgnoredEventSlice: boolean;
    hasDigestSummary: boolean;
    digestHasIgnoredFieldCoverage: boolean;
    replayRiskNotHigh: boolean;
    replayReadyForCp2: boolean;
  }>;
}>;

type M6VoiceCp4ReadinessGate = M6VoiceReplayProbeGate<Readonly<{
  hasReplayResult: boolean;
  hasCaptureBundle: boolean;
  finalPhaseActive: boolean;
  transitionVolumeSufficient: boolean;
  degradedTransitionsSufficient: boolean;
  recoveredTransitionsSufficient: boolean;
  endedTransitionsZero: boolean;
  digestRecoveryExhaustedZero: boolean;
  digestRiskNotHigh: boolean;
  replayReadyForCp2: boolean;
  hasIgnoredEventSlice: boolean;
  asyncVoiceSummaryPresent: boolean;
  deleteSummaryPresent: boolean;
  asyncVoiceStartFailureCountZero: boolean;
  deleteRemoteFailureCountZero: boolean;
}>>;

type M6VoiceReplayCaptureBundle = Readonly<{
  replay: M6VoiceReplayResult | null;
  capture: M6VoiceCaptureBundle | null;
  cp2EvidenceGate: M6VoiceCp2EvidenceGate;
}>;

type M6VoiceLongSessionReplayCaptureBundle = Readonly<{
  replay: M6VoiceReplayResult | null;
  capture: M6VoiceCaptureBundle | null;
  replayConfig: Readonly<{
    cycleCount: number;
    injectRecoveryExhausted: boolean;
  }>;
  cp4ReadinessGate: M6VoiceCp4ReadinessGate;
}>;

type M6VoiceReplaySuiteCaptureBundle = Readonly<{
  generatedAtUnixMs: number;
  weakNetwork: M6VoiceReplayCaptureBundle;
  accountSwitch: M6VoiceReplayCaptureBundle;
  suiteGate: Readonly<{
    pass: boolean;
    failedChecks: ReadonlyArray<string>;
    checks: Readonly<{
      weakNetworkPass: boolean;
      accountSwitchPass: boolean;
      weakNetworkReadyForCp2: boolean;
      accountSwitchReadyForCp2: boolean;
      weakAsyncVoiceSummaryPresent: boolean;
      accountAsyncVoiceSummaryPresent: boolean;
      weakDeleteSummaryPresent: boolean;
      accountDeleteSummaryPresent: boolean;
      weakAsyncVoiceRiskNotHigh: boolean;
      accountAsyncVoiceRiskNotHigh: boolean;
      weakDeleteRiskNotHigh: boolean;
      accountDeleteRiskNotHigh: boolean;
      weakAsyncVoiceStartFailureCountZero: boolean;
      accountAsyncVoiceStartFailureCountZero: boolean;
      weakDeleteRemoteFailureCountZero: boolean;
      accountDeleteRemoteFailureCountZero: boolean;
    }>;
  }>;
}>;

type M6VoiceReplaySuiteGate = M6VoiceReplaySuiteCaptureBundle["suiteGate"];
type M6VoiceReplaySuiteGateChecks = M6VoiceReplaySuiteGate["checks"];
type M6VoiceReplayBooleanChecks = Readonly<Record<string, boolean>>;

type M6VoiceReplayProbeGate<TChecks extends M6VoiceReplayBooleanChecks> = Readonly<{
  pass: boolean;
  failedChecks: ReadonlyArray<string>;
  checks: TChecks;
}>;

type M6VoiceReplayUnsupportedProbeGate = M6VoiceReplayProbeGate<Readonly<{
  finalPhaseUnsupported: boolean;
  transitionToUnsupportedObserved: boolean;
  digestUnsupportedCountObserved: boolean;
  latestReasonIsUnsupported: boolean;
}>>;

type M6VoiceReplayRecoveryExhaustedProbeGate = M6VoiceReplayProbeGate<Readonly<{
  finalPhaseEnded: boolean;
  finalReasonRecoveryExhausted: boolean;
  transitionToEndedObserved: boolean;
  endedReasonRecoveryExhaustedObserved: boolean;
  digestRecoveryExhaustedCountObserved: boolean;
}>>;

type M6VoiceReplaySingleDeviceSelfTestReport = Readonly<{
  generatedAtUnixMs: number;
  suite: M6VoiceReplaySuiteCaptureBundle;
  unsupportedProbe: M6VoiceReplayUnsupportedProbeGate;
  recoveryExhaustedProbe: M6VoiceReplayRecoveryExhaustedProbeGate;
  selfTestGate: M6VoiceReplayProbeGate<Readonly<{
    suiteGatePass: boolean;
    weakNetworkCp2Pass: boolean;
    accountSwitchCp2Pass: boolean;
    unsupportedProbePass: boolean;
    recoveryExhaustedProbePass: boolean;
  }>>;
}>;

type M6VoiceLongSessionSelfTestReport = Readonly<{
  generatedAtUnixMs: number;
  nominal: M6VoiceLongSessionReplayCaptureBundle;
  failureInjection: M6VoiceLongSessionReplayCaptureBundle;
  selfTestGate: M6VoiceReplayProbeGate<Readonly<{
    nominalPass: boolean;
    nominalFinalPhaseActive: boolean;
    nominalRecoveryExhaustedZero: boolean;
    failureGateRejected: boolean;
    failureFinalPhaseEnded: boolean;
    failureReasonRecoveryExhausted: boolean;
    failureGateFlagsRecoverySignals: boolean;
  }>>;
}>;

type M6VoiceLongSessionGateProbe = M6VoiceReplayProbeGate<Readonly<{
  hasCaptureBundle: boolean;
  hasReplayResult: boolean;
  gateMatchesExpectedPass: boolean;
  latestGateEventPresent: boolean;
  latestGateEventMatchesExpectedPass: boolean;
  latestGateEventFailureSampleAligned: boolean;
  finalPhaseAlignedWithExpectedPass: boolean;
  digestRecoveryExhaustedAlignedWithExpectedPass: boolean;
}>>;

type M6VoiceCp4CheckpointCaptureBundle = Readonly<{
  generatedAtUnixMs: number;
  longSession: M6VoiceLongSessionReplayCaptureBundle;
  gateProbe: M6VoiceLongSessionGateProbe;
  selfTest: M6VoiceLongSessionSelfTestReport;
  digestSummary: M6VoiceDigestSummary | null;
  cp4CheckpointGate: M6VoiceReplayProbeGate<Readonly<{
    longSessionGatePass: boolean;
    gateProbePass: boolean;
    selfTestGatePass: boolean;
    digestRiskNotHigh: boolean;
    digestUnexpectedGateFailZero: boolean;
  }>>;
}>;

type M6VoiceCp4ReleaseReadinessCaptureBundle = Readonly<{
  generatedAtUnixMs: number;
  checkpoint: M6VoiceCp4CheckpointCaptureBundle;
  latestLongSessionGateEventContext: Readonly<Record<string, unknown>> | null;
  latestCheckpointGateEventContext: Readonly<Record<string, unknown>> | null;
  digestSummary: M6VoiceDigestSummary | null;
  releaseReadinessGate: M6VoiceReplayProbeGate<Readonly<{
    checkpointGateMatchesExpected: boolean;
    longSessionGateEventObserved: boolean;
    checkpointGateEventObserved: boolean;
    checkpointEventMatchesGatePass: boolean;
    digestSummaryPresent: boolean;
    digestCheckpointGateCountObserved: boolean;
    digestLatestCheckpointAligned: boolean;
    digestUnexpectedCheckpointFailZeroWhenExpectedPass: boolean;
    digestRiskNotHighWhenExpectedPass: boolean;
  }>>;
}>;

type M6VoiceCp4ReleaseEvidenceBundle = Readonly<{
  generatedAtUnixMs: number;
  releaseReadiness: M6VoiceCp4ReleaseReadinessCaptureBundle;
  longSessionGateEventContexts: ReadonlyArray<Readonly<Record<string, unknown>>>;
  checkpointGateEventContexts: ReadonlyArray<Readonly<Record<string, unknown>>>;
  releaseReadinessGateEventContexts: ReadonlyArray<Readonly<Record<string, unknown>>>;
  recentWarnOrError: ReadonlyArray<Readonly<{
    name: string;
    level: string;
    atUnixMs: number;
    reasonCode: string | null;
  }>>;
  evidenceGate: M6VoiceReplayProbeGate<Readonly<{
    releaseReadinessGateMatchesExpected: boolean;
    longSessionEventObserved: boolean;
    checkpointEventObserved: boolean;
    releaseReadinessEventObserved: boolean;
    latestReleaseReadinessEventMatchesGate: boolean;
    digestSummaryPresent: boolean;
    digestRiskNotHighWhenExpectedPass: boolean;
    digestUnexpectedReleaseReadinessFailZeroWhenExpectedPass: boolean;
  }>>;
}>;

type M6VoiceV120CloseoutCaptureBundle = Readonly<{
  generatedAtUnixMs: number;
  cp3Suite: M6VoiceReplaySuiteCaptureBundle;
  cp4ReleaseEvidence: M6VoiceCp4ReleaseEvidenceBundle;
  closeoutGate: M6VoiceReplayProbeGate<Readonly<{
    cp3SuiteGatePass: boolean;
    weakNetworkCp2Pass: boolean;
    accountSwitchCp2Pass: boolean;
    cp4ReleaseEvidenceGateMatchesExpected: boolean;
    cp4ReleaseReadinessGateMatchesExpected: boolean;
    cp4CheckpointGateMatchesExpected: boolean;
    weakDeleteSummaryPresent: boolean;
    accountDeleteSummaryPresent: boolean;
    weakDeleteRemoteFailureCountZero: boolean;
    accountDeleteRemoteFailureCountZero: boolean;
    longSessionDeleteSummaryPresent: boolean;
    longSessionDeleteRemoteFailureCountZero: boolean;
    digestSummaryPresent: boolean;
    digestRiskNotHighWhenExpectedPass: boolean;
    digestUnexpectedReleaseEvidenceFailZeroWhenExpectedPass: boolean;
  }>>;
}>;

type M6VoiceConnectingWatchdogGate = M6VoiceReplayProbeGate<Readonly<{
  hasCaptureBundle: boolean;
  digestSummaryPresent: boolean;
  digestConnectTimeoutCoverage: boolean;
  connectTimeoutSlicePresent: boolean;
  connectTimeoutEventsObserved: boolean;
  noOpenRelayEvidenceObserved: boolean;
  latestTimeoutOpenRelayAligned: boolean;
  latestTimeoutRtcStateAligned: boolean;
}>>;

type M6VoiceConnectingWatchdogCaptureBundle = Readonly<{
  generatedAtUnixMs: number;
  captureWindowSize: number;
  expectedNoOpenRelay: boolean;
  capture: M6VoiceCaptureBundle | null;
  digestSummary: M6VoiceDigestSummary | null;
  connectTimeoutEvents: M6VoiceCaptureBundle["voice"]["connectTimeoutEvents"];
  latestConnectTimeoutEventContext: Readonly<Record<string, unknown>> | null;
  watchdogGate: M6VoiceConnectingWatchdogGate;
}>;

type M6VoiceConnectingWatchdogSelfTestReport = Readonly<{
  generatedAtUnixMs: number;
  noOpenRelayExpected: M6VoiceConnectingWatchdogCaptureBundle;
  openRelayUnexpected: M6VoiceConnectingWatchdogCaptureBundle;
  selfTestGate: M6VoiceReplayProbeGate<Readonly<{
    nominalPass: boolean;
    nominalNoOpenRelayEvidenceObserved: boolean;
    failureRejected: boolean;
    failureFlagsNoOpenRelayEvidence: boolean;
    timeoutEventsObservedInBothScenarios: boolean;
  }>>;
}>;

type M6VoiceReplayApi = Readonly<{
  reset: (options?: Readonly<{ maxRecoveryAttempts?: number }>) => RealtimeVoiceSessionState;
  getState: () => RealtimeVoiceSessionState;
  getLastReplay: () => M6VoiceReplayResult | null;
  start: (params?: Readonly<{
    roomId?: string;
    mode?: RealtimeVoiceSessionMode;
    supported?: boolean;
    unsupportedReasonCode?: RealtimeVoiceUnsupportedReasonCode;
    opusCapabilityStatus?: "available" | "missing";
    maxRecoveryAttempts?: number;
  }>) => RealtimeVoiceSessionState;
  connect: (params?: Readonly<{
    participantCount?: number;
    hasPeerSessionEvidence?: boolean;
  }>) => RealtimeVoiceSessionState;
  degrade: (params?: Readonly<{ reasonCode?: "network_degraded" | "transport_timeout" }>) => RealtimeVoiceSessionState;
  requestRecovery: () => RealtimeVoiceSessionState;
  failRecovery: (params?: Readonly<{ reasonCode?: "network_degraded" | "transport_timeout" }>) => RealtimeVoiceSessionState;
  leave: () => RealtimeVoiceSessionState;
  end: (params?: Readonly<{ reasonCode?: "left_by_user" | "session_closed" }>) => RealtimeVoiceSessionState;
  runWeakNetworkReplay: (params?: M6WeakNetworkReplayParams) => RealtimeVoiceSessionState;
  runWeakNetworkReplayCapture: (params?: M6WeakNetworkReplayParams) => M6VoiceReplayCaptureBundle;
  runWeakNetworkReplayCaptureJson: (params?: M6WeakNetworkReplayParams) => string;
  runAccountSwitchReplay: (params?: M6AccountSwitchReplayParams) => RealtimeVoiceSessionState;
  runAccountSwitchReplayCapture: (params?: M6AccountSwitchReplayParams) => M6VoiceReplayCaptureBundle;
  runAccountSwitchReplayCaptureJson: (params?: M6AccountSwitchReplayParams) => string;
  runLongSessionReplay: (params?: M6LongSessionReplayParams) => RealtimeVoiceSessionState;
  runLongSessionReplayCapture: (params?: M6LongSessionReplayParams) => M6VoiceLongSessionReplayCaptureBundle;
  runLongSessionReplayCaptureJson: (params?: M6LongSessionReplayParams) => string;
  runConnectingWatchdogCapture: (params?: M6ConnectingWatchdogCaptureParams) => M6VoiceConnectingWatchdogCaptureBundle;
  runConnectingWatchdogCaptureJson: (params?: M6ConnectingWatchdogCaptureParams) => string;
  runConnectingWatchdogGateProbe: (params?: M6ConnectingWatchdogCaptureParams) => M6VoiceConnectingWatchdogGate;
  runConnectingWatchdogGateProbeJson: (params?: M6ConnectingWatchdogCaptureParams) => string;
  runConnectingWatchdogSelfTest: (params?: M6ConnectingWatchdogSelfTestParams) => M6VoiceConnectingWatchdogSelfTestReport;
  runConnectingWatchdogSelfTestJson: (params?: M6ConnectingWatchdogSelfTestParams) => string;
  runCp4LongSessionGateProbe: (params?: M6Cp4LongSessionGateProbeParams) => M6VoiceLongSessionGateProbe;
  runCp4LongSessionGateProbeJson: (params?: M6Cp4LongSessionGateProbeParams) => string;
  runCp4LongSessionSelfTest: (params?: M6Cp4LongSessionSelfTestParams) => M6VoiceLongSessionSelfTestReport;
  runCp4LongSessionSelfTestJson: (params?: M6Cp4LongSessionSelfTestParams) => string;
  runCp4CheckpointCapture: (params?: M6Cp4CheckpointCaptureParams) => M6VoiceCp4CheckpointCaptureBundle;
  runCp4CheckpointCaptureJson: (params?: M6Cp4CheckpointCaptureParams) => string;
  runCp4CheckpointGateProbe: (params?: M6Cp4CheckpointCaptureParams) => M6VoiceCp4CheckpointCaptureBundle["cp4CheckpointGate"];
  runCp4CheckpointGateProbeJson: (params?: M6Cp4CheckpointCaptureParams) => string;
  runCp4ReleaseReadinessCapture: (params?: M6Cp4CheckpointCaptureParams) => M6VoiceCp4ReleaseReadinessCaptureBundle;
  runCp4ReleaseReadinessCaptureJson: (params?: M6Cp4CheckpointCaptureParams) => string;
  runCp4ReleaseReadinessGateProbe: (params?: M6Cp4CheckpointCaptureParams) => M6VoiceCp4ReleaseReadinessCaptureBundle["releaseReadinessGate"];
  runCp4ReleaseReadinessGateProbeJson: (params?: M6Cp4CheckpointCaptureParams) => string;
  runCp4ReleaseEvidenceCapture: (params?: M6Cp4ReleaseEvidenceParams) => M6VoiceCp4ReleaseEvidenceBundle;
  runCp4ReleaseEvidenceCaptureJson: (params?: M6Cp4ReleaseEvidenceParams) => string;
  runCp4ReleaseEvidenceGateProbe: (params?: M6Cp4ReleaseEvidenceParams) => M6VoiceCp4ReleaseEvidenceBundle["evidenceGate"];
  runCp4ReleaseEvidenceGateProbeJson: (params?: M6Cp4ReleaseEvidenceParams) => string;
  runV120CloseoutCapture: (params?: M6V120CloseoutParams) => M6VoiceV120CloseoutCaptureBundle;
  runV120CloseoutCaptureJson: (params?: M6V120CloseoutParams) => string;
  runV120CloseoutGateProbe: (params?: M6V120CloseoutParams) => M6VoiceV120CloseoutCaptureBundle["closeoutGate"];
  runV120CloseoutGateProbeJson: (params?: M6V120CloseoutParams) => string;
  runCp3ReplaySuiteCapture: (params?: Readonly<{
    baseUnixMs?: number;
    captureWindowSize?: number;
    clearAppEvents?: boolean;
    mode?: RealtimeVoiceSessionMode;
  }>) => M6VoiceReplaySuiteCaptureBundle;
  runCp3ReplaySuiteCaptureJson: (params?: Readonly<{
    baseUnixMs?: number;
    captureWindowSize?: number;
    clearAppEvents?: boolean;
    mode?: RealtimeVoiceSessionMode;
  }>) => string;
  runCp3ReplaySuiteGateProbe: (params?: Readonly<{
    baseUnixMs?: number;
    captureWindowSize?: number;
    clearAppEvents?: boolean;
    mode?: RealtimeVoiceSessionMode;
  }>) => M6VoiceReplaySuiteGate;
  runCp3ReplaySuiteGateProbeJson: (params?: Readonly<{
    baseUnixMs?: number;
    captureWindowSize?: number;
    clearAppEvents?: boolean;
    mode?: RealtimeVoiceSessionMode;
  }>) => string;
  runCp3SingleDeviceSelfTest: (params?: Readonly<{
    baseUnixMs?: number;
    captureWindowSize?: number;
    clearAppEvents?: boolean;
    mode?: RealtimeVoiceSessionMode;
  }>) => M6VoiceReplaySingleDeviceSelfTestReport;
  runCp3SingleDeviceSelfTestJson: (params?: Readonly<{
    baseUnixMs?: number;
    captureWindowSize?: number;
    clearAppEvents?: boolean;
    mode?: RealtimeVoiceSessionMode;
  }>) => string;
}>;

type M6VoiceReplayWindow = Window & {
  obscurM6VoiceReplay?: M6VoiceReplayApi;
  obscurM6VoiceCapture?: Readonly<{
    capture?: (eventWindowSize?: number) => M6VoiceCaptureBundle;
  }>;
  obscurAppEvents?: Readonly<{
    clear?: () => void;
    findByName?: (name: string, count?: number) => ReadonlyArray<Readonly<{
      context?: Readonly<Record<string, unknown>>;
    }>>;
    getCrossDeviceSyncDigest?: (count?: number) => Readonly<{
      summary?: Readonly<{
        realtimeVoiceSession?: unknown;
      }>;
      recentWarnOrError?: ReadonlyArray<Readonly<{
        name?: unknown;
        level?: unknown;
        atUnixMs?: unknown;
        reasonCode?: unknown;
      }>>;
    }>;
  }>;
};

declare global {
  interface Window {
    obscurM6VoiceReplay?: M6VoiceReplayApi;
  }
}

const DEFAULT_CAPTURE_WINDOW_SIZE = 400;
const DEFAULT_WEAK_REPLAY_TRANSITION_COUNT = 5;
const DEFAULT_ACCOUNT_SWITCH_REPLAY_TRANSITION_COUNT = 6;
const DEFAULT_LONG_SESSION_CYCLE_COUNT = 6;
const EMPTY_REPLAY_SUITE_GATE_CHECKS: M6VoiceReplaySuiteGateChecks = {
  weakNetworkPass: false,
  accountSwitchPass: false,
  weakNetworkReadyForCp2: false,
  accountSwitchReadyForCp2: false,
  weakAsyncVoiceSummaryPresent: false,
  accountAsyncVoiceSummaryPresent: false,
  weakDeleteSummaryPresent: false,
  accountDeleteSummaryPresent: false,
  weakAsyncVoiceRiskNotHigh: false,
  accountAsyncVoiceRiskNotHigh: false,
  weakDeleteRiskNotHigh: false,
  accountDeleteRiskNotHigh: false,
  weakAsyncVoiceStartFailureCountZero: false,
  accountAsyncVoiceStartFailureCountZero: false,
  weakDeleteRemoteFailureCountZero: false,
  accountDeleteRemoteFailureCountZero: false,
};
const EMPTY_CP4_CHECKPOINT_GATE_CHECKS: M6VoiceCp4CheckpointCaptureBundle["cp4CheckpointGate"]["checks"] = {
  longSessionGatePass: false,
  gateProbePass: false,
  selfTestGatePass: false,
  digestRiskNotHigh: false,
  digestUnexpectedGateFailZero: false,
};
const EMPTY_CP4_RELEASE_READINESS_GATE_CHECKS: M6VoiceCp4ReleaseReadinessCaptureBundle["releaseReadinessGate"]["checks"] = {
  checkpointGateMatchesExpected: false,
  longSessionGateEventObserved: false,
  checkpointGateEventObserved: false,
  checkpointEventMatchesGatePass: false,
  digestSummaryPresent: false,
  digestCheckpointGateCountObserved: false,
  digestLatestCheckpointAligned: false,
  digestUnexpectedCheckpointFailZeroWhenExpectedPass: false,
  digestRiskNotHighWhenExpectedPass: false,
};
const EMPTY_CP4_RELEASE_EVIDENCE_GATE_CHECKS: M6VoiceCp4ReleaseEvidenceBundle["evidenceGate"]["checks"] = {
  releaseReadinessGateMatchesExpected: false,
  longSessionEventObserved: false,
  checkpointEventObserved: false,
  releaseReadinessEventObserved: false,
  latestReleaseReadinessEventMatchesGate: false,
  digestSummaryPresent: false,
  digestRiskNotHighWhenExpectedPass: false,
  digestUnexpectedReleaseReadinessFailZeroWhenExpectedPass: false,
};
const EMPTY_V120_CLOSEOUT_GATE_CHECKS: M6VoiceV120CloseoutCaptureBundle["closeoutGate"]["checks"] = {
  cp3SuiteGatePass: false,
  weakNetworkCp2Pass: false,
  accountSwitchCp2Pass: false,
  cp4ReleaseEvidenceGateMatchesExpected: false,
  cp4ReleaseReadinessGateMatchesExpected: false,
  cp4CheckpointGateMatchesExpected: false,
  weakDeleteSummaryPresent: false,
  accountDeleteSummaryPresent: false,
  weakDeleteRemoteFailureCountZero: false,
  accountDeleteRemoteFailureCountZero: false,
  longSessionDeleteSummaryPresent: false,
  longSessionDeleteRemoteFailureCountZero: false,
  digestSummaryPresent: false,
  digestRiskNotHighWhenExpectedPass: false,
  digestUnexpectedReleaseEvidenceFailZeroWhenExpectedPass: false,
};
const EMPTY_CONNECTING_WATCHDOG_GATE_CHECKS: M6VoiceConnectingWatchdogGate["checks"] = {
  hasCaptureBundle: false,
  digestSummaryPresent: false,
  digestConnectTimeoutCoverage: false,
  connectTimeoutSlicePresent: false,
  connectTimeoutEventsObserved: false,
  noOpenRelayEvidenceObserved: false,
  latestTimeoutOpenRelayAligned: false,
  latestTimeoutRtcStateAligned: false,
};
const SUPPORTED_UNSUPPORTED_REASON_CODES = new Set<string>([
  "webrtc_unavailable",
  "insecure_context",
  "media_devices_unavailable",
  "peer_connection_unavailable",
  "add_track_unavailable",
  "unsupported_runtime",
]);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

const toPositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }
  return fallback;
};

const toNumber = (value: unknown): number => (
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0
);

const toNumberOrNull = (value: unknown): number | null => (
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : null
);

const toStringOrNull = (value: unknown): string | null => (
  typeof value === "string" && value.trim().length > 0 ? value : null
);

const toBooleanOrNull = (value: unknown): boolean | null => (
  typeof value === "boolean" ? value : null
);

const toRoomIdHint = (roomId: string | null): string | null => {
  if (typeof roomId !== "string" || roomId.length === 0) {
    return null;
  }
  if (roomId.length <= 16) {
    return roomId;
  }
  return `${roomId.slice(0, 8)}...${roomId.slice(-8)}`;
};

const parseDigestSummary = (value: unknown): M6VoiceDigestSummary | null => {
  if (!isRecord(value)) {
    return null;
  }
  const riskLevel = value.riskLevel;
  if (riskLevel !== "none" && riskLevel !== "watch" && riskLevel !== "high") {
    return null;
  }
  return {
    riskLevel,
    transitionCount: toNumber(value.transitionCount),
    degradedCount: toNumber(value.degradedCount),
    unsupportedCount: toNumber(value.unsupportedCount),
    recoveryExhaustedCount: toNumber(value.recoveryExhaustedCount),
    staleEventIgnoredCount: toNumber(value.staleEventIgnoredCount),
    connectTimeoutDiagnosticsCount: toNumber(value.connectTimeoutDiagnosticsCount),
    connectTimeoutNoOpenRelayCount: toNumber(value.connectTimeoutNoOpenRelayCount),
    connectingWatchdogGateCount: toNumber(value.connectingWatchdogGateCount),
    connectingWatchdogGatePassCount: toNumber(value.connectingWatchdogGatePassCount),
    connectingWatchdogGateFailCount: toNumber(value.connectingWatchdogGateFailCount),
    unexpectedConnectingWatchdogGateFailCount: toNumber(value.unexpectedConnectingWatchdogGateFailCount),
    longSessionGateCount: toNumber(value.longSessionGateCount),
    longSessionGatePassCount: toNumber(value.longSessionGatePassCount),
    longSessionGateFailCount: toNumber(value.longSessionGateFailCount),
    unexpectedLongSessionGateFailCount: toNumber(value.unexpectedLongSessionGateFailCount),
    checkpointGateCount: toNumber(value.checkpointGateCount),
    checkpointGatePassCount: toNumber(value.checkpointGatePassCount),
    checkpointGateFailCount: toNumber(value.checkpointGateFailCount),
    unexpectedCheckpointGateFailCount: toNumber(value.unexpectedCheckpointGateFailCount),
    releaseReadinessGateCount: toNumber(value.releaseReadinessGateCount),
    releaseReadinessGatePassCount: toNumber(value.releaseReadinessGatePassCount),
    releaseReadinessGateFailCount: toNumber(value.releaseReadinessGateFailCount),
    unexpectedReleaseReadinessGateFailCount: toNumber(value.unexpectedReleaseReadinessGateFailCount),
    releaseEvidenceGateCount: toNumber(value.releaseEvidenceGateCount),
    releaseEvidenceGatePassCount: toNumber(value.releaseEvidenceGatePassCount),
    releaseEvidenceGateFailCount: toNumber(value.releaseEvidenceGateFailCount),
    unexpectedReleaseEvidenceGateFailCount: toNumber(value.unexpectedReleaseEvidenceGateFailCount),
    closeoutGateCount: toNumber(value.closeoutGateCount),
    closeoutGatePassCount: toNumber(value.closeoutGatePassCount),
    closeoutGateFailCount: toNumber(value.closeoutGateFailCount),
    unexpectedCloseoutGateFailCount: toNumber(value.unexpectedCloseoutGateFailCount),
    latestToPhase: toStringOrNull(value.latestToPhase),
    latestReasonCode: toStringOrNull(value.latestReasonCode),
    latestIgnoredReasonCode: toStringOrNull(value.latestIgnoredReasonCode),
    latestConnectTimeoutRtcConnectionState: toStringOrNull(value.latestConnectTimeoutRtcConnectionState),
    latestConnectTimeoutOpenRelayCount: toNumberOrNull(value.latestConnectTimeoutOpenRelayCount),
    latestConnectingWatchdogGatePass: toBooleanOrNull(value.latestConnectingWatchdogGatePass),
    latestConnectingWatchdogGateFailedCheckSample: toStringOrNull(value.latestConnectingWatchdogGateFailedCheckSample),
    latestLongSessionGatePass: toBooleanOrNull(value.latestLongSessionGatePass),
    latestLongSessionGateFailedCheckSample: toStringOrNull(value.latestLongSessionGateFailedCheckSample),
    latestCheckpointGatePass: toBooleanOrNull(value.latestCheckpointGatePass),
    latestCheckpointGateFailedCheckSample: toStringOrNull(value.latestCheckpointGateFailedCheckSample),
    latestReleaseReadinessGatePass: toBooleanOrNull(value.latestReleaseReadinessGatePass),
    latestReleaseReadinessGateFailedCheckSample: toStringOrNull(value.latestReleaseReadinessGateFailedCheckSample),
    latestReleaseEvidenceGatePass: toBooleanOrNull(value.latestReleaseEvidenceGatePass),
    latestReleaseEvidenceGateFailedCheckSample: toStringOrNull(value.latestReleaseEvidenceGateFailedCheckSample),
    latestCloseoutGatePass: toBooleanOrNull(value.latestCloseoutGatePass),
    latestCloseoutGateFailedCheckSample: toStringOrNull(value.latestCloseoutGateFailedCheckSample),
  };
};

const readEventsByName = (
  root: M6VoiceReplayWindow,
  name: string,
  captureWindowSize: number,
): ReadonlyArray<Readonly<{ context?: Readonly<Record<string, unknown>> }>> => {
  try {
    if (typeof root.obscurAppEvents?.findByName !== "function") {
      return [];
    }
    return root.obscurAppEvents.findByName(name, captureWindowSize) ?? [];
  } catch {
    return [];
  }
};

const readDigestSummary = (
  root: M6VoiceReplayWindow,
  captureWindowSize: number,
): M6VoiceDigestSummary | null => {
  try {
    if (typeof root.obscurAppEvents?.getCrossDeviceSyncDigest !== "function") {
      return null;
    }
    return parseDigestSummary(
      root.obscurAppEvents.getCrossDeviceSyncDigest(captureWindowSize)?.summary?.realtimeVoiceSession,
    );
  } catch {
    return null;
  }
};

const readRecentWarnOrError = (
  root: M6VoiceReplayWindow,
  captureWindowSize: number,
  limit: number,
): ReadonlyArray<Readonly<{
  name: string;
  level: string;
  atUnixMs: number;
  reasonCode: string | null;
}>> => {
  try {
    const raw = root.obscurAppEvents?.getCrossDeviceSyncDigest?.(captureWindowSize)?.recentWarnOrError;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .slice(-Math.max(1, limit))
      .map((entry) => ({
        name: toStringOrNull(entry?.name) ?? "unknown",
        level: toStringOrNull(entry?.level) ?? "unknown",
        atUnixMs: toNumber(entry?.atUnixMs),
        reasonCode: toStringOrNull(entry?.reasonCode),
      }));
  } catch {
    return [];
  }
};

const countTransitionsToPhase = (
  events: ReadonlyArray<Readonly<{ context?: Readonly<Record<string, unknown>> }>>,
  toPhase: string,
): number => (
  events.filter((event) => toStringOrNull(event.context?.toPhase) === toPhase).length
);

const getLatestTransitionEvent = (
  events: ReadonlyArray<Readonly<{ context?: Readonly<Record<string, unknown>> }>>,
): Readonly<{ context?: Readonly<Record<string, unknown>> }> | null => {
  if (events.length === 0) {
    return null;
  }
  return events[events.length - 1] ?? null;
};

const buildBooleanGate = <TChecks extends M6VoiceReplayBooleanChecks>(
  checks: TChecks,
): M6VoiceReplayProbeGate<TChecks> => {
  const failedChecks = Object.entries(checks)
    .filter(([, pass]) => pass !== true)
    .map(([name]) => name);
  return {
    pass: failedChecks.length === 0,
    failedChecks,
    checks,
  };
};

const countTransitionsByRoomAndPhase = (
  events: ReadonlyArray<Readonly<{ context?: Readonly<Record<string, unknown>> }>>,
  params: Readonly<{
    roomIdHint: string | null;
    toPhase: string;
  }>,
): number => {
  if (params.roomIdHint === null) {
    return 0;
  }
  return events.filter((event) => (
    toStringOrNull(event.context?.roomIdHint) === params.roomIdHint
    && toStringOrNull(event.context?.toPhase) === params.toPhase
  )).length;
};

const countDistinctRoomHints = (
  events: ReadonlyArray<Readonly<{ context?: Readonly<Record<string, unknown>> }>>,
): number => {
  const hints = new Set<string>();
  events.forEach((event) => {
    const roomIdHint = toStringOrNull(event.context?.roomIdHint);
    if (roomIdHint) {
      hints.add(roomIdHint);
    }
  });
  return hints.size;
};

const countRecoveredActiveTransitions = (
  events: ReadonlyArray<Readonly<{ context?: Readonly<Record<string, unknown>> }>>,
): number => {
  let degradedSeen = false;
  let recoveredCount = 0;
  events.forEach((event) => {
    const targetPhase = toStringOrNull(event.context?.toPhase);
    if (targetPhase === "degraded") {
      degradedSeen = true;
      return;
    }
    if (degradedSeen && targetPhase === "active") {
      recoveredCount += 1;
    }
  });
  return recoveredCount;
};

const buildReplayReadiness = (params: Readonly<{
  scenario: M6VoiceReplayScenario;
  transitionEventCount: number;
  degradedTransitionCount: number;
  recoveredActiveTransitionCount: number;
  endedTransitionCount: number;
  roomHintCount: number;
  postSwitchActiveTransitionCount: number;
  latestDigestSummary: M6VoiceDigestSummary | null;
}>): M6VoiceReplayResult["replayReadiness"] => {
  const minTransitionCount = params.scenario === "account_switch"
    ? DEFAULT_ACCOUNT_SWITCH_REPLAY_TRANSITION_COUNT
    : DEFAULT_WEAK_REPLAY_TRANSITION_COUNT;
  const hasTransitionEvents = params.transitionEventCount >= minTransitionCount;
  const hasDegradedTransition = params.degradedTransitionCount >= 1;
  const hasRecoveredActiveTransition = params.recoveredActiveTransitionCount >= 1;
  const hasEndedTransition = params.endedTransitionCount >= 1;
  const hasMultiRoomEvidence = params.roomHintCount >= 2;
  const hasPostSwitchActiveTransition = params.postSwitchActiveTransitionCount >= 1;
  const digestHasTransitionCount = (params.latestDigestSummary?.transitionCount ?? 0) >= 1;
  const digestHasDegradedCount = params.scenario === "account_switch"
    ? true
    : (params.latestDigestSummary?.degradedCount ?? 0) >= 1;
  const digestHasIgnoredFieldCoverage = params.latestDigestSummary !== null
    && typeof params.latestDigestSummary.staleEventIgnoredCount === "number"
    && Object.prototype.hasOwnProperty.call(params.latestDigestSummary, "latestIgnoredReasonCode");
  const riskNotHigh = params.latestDigestSummary !== null
    && params.latestDigestSummary.riskLevel !== "high";
  const scenarioReady = params.scenario === "account_switch"
    ? (hasEndedTransition && hasMultiRoomEvidence && hasPostSwitchActiveTransition)
    : (hasDegradedTransition && hasRecoveredActiveTransition);
  return {
    scenario: params.scenario,
    hasTransitionEvents,
    hasDegradedTransition,
    hasRecoveredActiveTransition,
    hasEndedTransition,
    hasMultiRoomEvidence,
    hasPostSwitchActiveTransition,
    digestHasTransitionCount,
    digestHasDegradedCount,
    digestHasIgnoredFieldCoverage,
    riskNotHigh,
    readyForCp2Evidence: (
      hasTransitionEvents
      && scenarioReady
      && digestHasTransitionCount
      && digestHasDegradedCount
      && digestHasIgnoredFieldCoverage
      && riskNotHigh
    ),
  };
};

const buildCp2EvidenceGate = (
  replay: M6VoiceReplayResult | null,
  capture: M6VoiceCaptureBundle | null,
): M6VoiceCp2EvidenceGate => {
  const scenario = replay?.scenario ?? "weak_network";
  const replayDigestSummary = replay?.latestDigestSummary ?? null;
  const scenarioGateChecks = scenario === "account_switch"
    ? {
      hasDegradedTransition: true,
      hasRecoveredActiveTransition: true,
      hasEndedTransition: (replay?.endedTransitionCount ?? 0) >= 1,
      hasMultiRoomEvidence: (replay?.roomHintCount ?? 0) >= 2,
      hasPostSwitchActiveTransition: replay?.replayReadiness.hasPostSwitchActiveTransition === true,
    }
    : {
      hasDegradedTransition: (replay?.degradedTransitionCount ?? 0) >= 1,
      hasRecoveredActiveTransition: (replay?.recoveredActiveTransitionCount ?? 0) >= 1,
      hasEndedTransition: true,
      hasMultiRoomEvidence: true,
      hasPostSwitchActiveTransition: true,
    };
  const checks = {
    scenario,
    hasReplayResult: replay !== null,
    hasCaptureBundle: capture !== null,
    hasTransitionEvents: (replay?.transitionEventCount ?? 0) >= (
      scenario === "account_switch"
        ? DEFAULT_ACCOUNT_SWITCH_REPLAY_TRANSITION_COUNT
        : DEFAULT_WEAK_REPLAY_TRANSITION_COUNT
    ),
    hasDegradedTransition: scenarioGateChecks.hasDegradedTransition,
    hasRecoveredActiveTransition: scenarioGateChecks.hasRecoveredActiveTransition,
    hasEndedTransition: scenarioGateChecks.hasEndedTransition,
    hasMultiRoomEvidence: scenarioGateChecks.hasMultiRoomEvidence,
    hasPostSwitchActiveTransition: scenarioGateChecks.hasPostSwitchActiveTransition,
    hasIgnoredEventSlice: Array.isArray(capture?.voice?.ignoredEvents),
    hasDigestSummary: replay?.latestDigestSummary !== null,
    digestHasIgnoredFieldCoverage: replay?.replayReadiness?.digestHasIgnoredFieldCoverage === true,
    replayRiskNotHigh: replayDigestSummary !== null
      && replayDigestSummary.riskLevel !== "high",
    replayReadyForCp2: replay?.replayReadiness?.readyForCp2Evidence === true,
  } as const;

  const failedChecks = Object.entries(checks)
    .filter(([name, pass]) => name !== "scenario" && pass !== true)
    .map(([key]) => key);

  return {
    pass: failedChecks.length === 0,
    failedChecks,
    checks,
  };
};

const buildCp4ReadinessGate = (params: Readonly<{
  replay: M6VoiceReplayResult | null;
  capture: M6VoiceCaptureBundle | null;
  cycleCount: number;
}>): M6VoiceCp4ReadinessGate => {
  const replayDigestSummary = params.replay?.latestDigestSummary ?? null;
  const asyncVoiceSummary = params.capture?.voice.asyncVoiceNoteSummary ?? null;
  const deleteSummary = params.capture?.voice.deleteConvergenceSummary ?? null;
  const minimumTransitionCount = (params.cycleCount * 3) + 2;
  const checks = {
    hasReplayResult: params.replay !== null,
    hasCaptureBundle: params.capture !== null,
    finalPhaseActive: params.replay?.finalState.phase === "active",
    transitionVolumeSufficient: (params.replay?.transitionEventCount ?? 0) >= minimumTransitionCount,
    degradedTransitionsSufficient: (params.replay?.degradedTransitionCount ?? 0) >= params.cycleCount,
    recoveredTransitionsSufficient: (params.replay?.recoveredActiveTransitionCount ?? 0) >= params.cycleCount,
    endedTransitionsZero: (params.replay?.endedTransitionCount ?? -1) === 0,
    digestRecoveryExhaustedZero: (replayDigestSummary?.recoveryExhaustedCount ?? -1) === 0,
    digestRiskNotHigh: replayDigestSummary !== null
      && replayDigestSummary.riskLevel !== "high",
    replayReadyForCp2: params.replay?.replayReadiness.readyForCp2Evidence === true,
    hasIgnoredEventSlice: Array.isArray(params.capture?.voice.ignoredEvents),
    asyncVoiceSummaryPresent: asyncVoiceSummary !== null,
    deleteSummaryPresent: deleteSummary !== null,
    asyncVoiceStartFailureCountZero: (asyncVoiceSummary?.recordingStartFailedCount ?? -1) === 0,
    deleteRemoteFailureCountZero: (deleteSummary?.remoteFailedCount ?? -1) === 0,
  } as const;
  return buildBooleanGate(checks);
};

const buildCp4LongSessionSelfTestGate = (params: Readonly<{
  nominal: M6VoiceLongSessionReplayCaptureBundle;
  failureInjection: M6VoiceLongSessionReplayCaptureBundle;
}>): M6VoiceLongSessionSelfTestReport["selfTestGate"] => {
  const failureFailedChecks = new Set(params.failureInjection.cp4ReadinessGate.failedChecks);
  const checks = {
    nominalPass: params.nominal.cp4ReadinessGate.pass,
    nominalFinalPhaseActive: params.nominal.replay?.finalState.phase === "active",
    nominalRecoveryExhaustedZero: (params.nominal.replay?.latestDigestSummary?.recoveryExhaustedCount ?? -1) === 0,
    failureGateRejected: params.failureInjection.cp4ReadinessGate.pass === false,
    failureFinalPhaseEnded: params.failureInjection.replay?.finalState.phase === "ended",
    failureReasonRecoveryExhausted: (
      params.failureInjection.replay?.finalState.lastTransitionReasonCode === "recovery_exhausted"
    ),
    failureGateFlagsRecoverySignals: (
      failureFailedChecks.has("endedTransitionsZero")
      && failureFailedChecks.has("digestRecoveryExhaustedZero")
    ),
  } as const;
  return buildBooleanGate(checks);
};

const buildCp4LongSessionGateProbe = (params: Readonly<{
  capture: M6VoiceLongSessionReplayCaptureBundle | null;
  expectedPass: boolean;
  latestGateEventContext: Readonly<Record<string, unknown>> | null;
}>): M6VoiceLongSessionGateProbe => {
  const gate = params.capture?.cp4ReadinessGate ?? null;
  const replay = params.capture?.replay ?? null;
  const eventContext = params.latestGateEventContext;
  const latestEventPass = eventContext?.cp4Pass;
  const latestEventFailureSample = toStringOrNull(eventContext?.failedCheckSample);
  const digestRecoveryExhaustedCount = replay?.latestDigestSummary?.recoveryExhaustedCount;
  const checks = {
    hasCaptureBundle: params.capture !== null,
    hasReplayResult: replay !== null,
    gateMatchesExpectedPass: gate?.pass === params.expectedPass,
    latestGateEventPresent: eventContext !== null,
    latestGateEventMatchesExpectedPass: latestEventPass === params.expectedPass,
    latestGateEventFailureSampleAligned: params.expectedPass
      ? latestEventFailureSample === null
      : latestEventFailureSample !== null,
    finalPhaseAlignedWithExpectedPass: params.expectedPass
      ? replay?.finalState.phase === "active"
      : replay?.finalState.phase !== "active",
    digestRecoveryExhaustedAlignedWithExpectedPass: params.expectedPass
      ? (typeof digestRecoveryExhaustedCount === "number" && digestRecoveryExhaustedCount === 0)
      : true,
  } as const;
  return buildBooleanGate(checks);
};

const buildConnectingWatchdogGate = (params: Readonly<{
  capture: M6VoiceCaptureBundle | null;
  digestSummary: M6VoiceDigestSummary | null;
  connectTimeoutEvents: M6VoiceCaptureBundle["voice"]["connectTimeoutEvents"];
  latestConnectTimeoutEventContext: Readonly<Record<string, unknown>> | null;
  expectedNoOpenRelay: boolean;
}>): M6VoiceConnectingWatchdogGate => {
  const latestEventOpenRelayCount = toNumberOrNull(params.latestConnectTimeoutEventContext?.openRelayCount);
  const latestEventRtcState = toStringOrNull(params.latestConnectTimeoutEventContext?.rtcConnectionState);
  const digestSummary = params.digestSummary;
  const digestConnectTimeoutCoverage = digestSummary !== null
    && typeof digestSummary.connectTimeoutDiagnosticsCount === "number"
    && typeof digestSummary.connectTimeoutNoOpenRelayCount === "number"
    && Object.prototype.hasOwnProperty.call(digestSummary, "latestConnectTimeoutRtcConnectionState")
    && Object.prototype.hasOwnProperty.call(digestSummary, "latestConnectTimeoutOpenRelayCount");
  const connectTimeoutEventsObserved = (
    params.connectTimeoutEvents.length >= 1
    || (digestSummary?.connectTimeoutDiagnosticsCount ?? 0) >= 1
  );
  const digestLatestOpenRelayCount = digestSummary?.latestConnectTimeoutOpenRelayCount ?? null;
  const digestLatestRtcState = digestSummary?.latestConnectTimeoutRtcConnectionState ?? null;
  const noOpenRelayEvidenceObserved = params.expectedNoOpenRelay
    ? (
      (digestSummary?.connectTimeoutNoOpenRelayCount ?? 0) >= 1
      || (latestEventOpenRelayCount !== null && latestEventOpenRelayCount <= 0)
    )
    : true;
  const latestTimeoutOpenRelayAligned = (
    digestLatestOpenRelayCount === null
    || latestEventOpenRelayCount === null
    || digestLatestOpenRelayCount === latestEventOpenRelayCount
  );
  const latestTimeoutRtcStateAligned = (
    digestLatestRtcState === null
    || latestEventRtcState === null
    || digestLatestRtcState === latestEventRtcState
  );
  const checks = {
    hasCaptureBundle: params.capture !== null,
    digestSummaryPresent: digestSummary !== null,
    digestConnectTimeoutCoverage,
    connectTimeoutSlicePresent: Array.isArray(params.capture?.voice.connectTimeoutEvents),
    connectTimeoutEventsObserved,
    noOpenRelayEvidenceObserved,
    latestTimeoutOpenRelayAligned,
    latestTimeoutRtcStateAligned,
  } as const;
  return buildBooleanGate(checks);
};

const buildConnectingWatchdogSelfTestGate = (params: Readonly<{
  noOpenRelayExpected: M6VoiceConnectingWatchdogCaptureBundle;
  openRelayUnexpected: M6VoiceConnectingWatchdogCaptureBundle;
}>): M6VoiceConnectingWatchdogSelfTestReport["selfTestGate"] => {
  const failureFailedChecks = new Set(params.openRelayUnexpected.watchdogGate.failedChecks);
  const checks = {
    nominalPass: params.noOpenRelayExpected.watchdogGate.pass,
    nominalNoOpenRelayEvidenceObserved: params.noOpenRelayExpected.watchdogGate.checks.noOpenRelayEvidenceObserved,
    failureRejected: params.openRelayUnexpected.watchdogGate.pass === false,
    failureFlagsNoOpenRelayEvidence: failureFailedChecks.has("noOpenRelayEvidenceObserved"),
    timeoutEventsObservedInBothScenarios: (
      params.noOpenRelayExpected.connectTimeoutEvents.length >= 1
      && params.openRelayUnexpected.connectTimeoutEvents.length >= 1
    ),
  } as const;
  return buildBooleanGate(checks);
};

const buildCp4CheckpointGate = (params: Readonly<{
  longSession: M6VoiceLongSessionReplayCaptureBundle;
  gateProbe: M6VoiceLongSessionGateProbe;
  selfTest: M6VoiceLongSessionSelfTestReport;
  digestSummary: M6VoiceDigestSummary | null;
}>): M6VoiceCp4CheckpointCaptureBundle["cp4CheckpointGate"] => {
  const checks = {
    longSessionGatePass: params.longSession.cp4ReadinessGate.pass,
    gateProbePass: params.gateProbe.pass,
    selfTestGatePass: params.selfTest.selfTestGate.pass,
    digestRiskNotHigh: (
      params.digestSummary !== null
      && params.digestSummary.riskLevel !== "high"
    ),
    digestUnexpectedGateFailZero: (
      (params.digestSummary?.unexpectedLongSessionGateFailCount ?? -1) === 0
    ),
  } as const;
  return buildBooleanGate(checks);
};

const buildCp4ReleaseReadinessGate = (params: Readonly<{
  checkpoint: M6VoiceCp4CheckpointCaptureBundle;
  expectedPass: boolean;
  latestLongSessionGateEventContext: Readonly<Record<string, unknown>> | null;
  latestCheckpointGateEventContext: Readonly<Record<string, unknown>> | null;
  digestSummary: M6VoiceDigestSummary | null;
}>): M6VoiceCp4ReleaseReadinessCaptureBundle["releaseReadinessGate"] => {
  const latestCheckpointEventPass = toBooleanOrNull(
    params.latestCheckpointGateEventContext?.cp4CheckpointPass,
  );
  const digestLatestCheckpointPass = params.digestSummary?.latestCheckpointGatePass;
  const checks = {
    checkpointGateMatchesExpected: params.checkpoint.cp4CheckpointGate.pass === params.expectedPass,
    longSessionGateEventObserved: (
      params.latestLongSessionGateEventContext !== null
      || params.checkpoint.longSession.replay !== null
    ),
    checkpointGateEventObserved: params.latestCheckpointGateEventContext !== null,
    checkpointEventMatchesGatePass: latestCheckpointEventPass === params.checkpoint.cp4CheckpointGate.pass,
    digestSummaryPresent: params.digestSummary !== null,
    digestCheckpointGateCountObserved: (params.digestSummary?.checkpointGateCount ?? 0) >= 1,
    digestLatestCheckpointAligned: (
      digestLatestCheckpointPass === null
        ? latestCheckpointEventPass === params.checkpoint.cp4CheckpointGate.pass
        : digestLatestCheckpointPass === params.checkpoint.cp4CheckpointGate.pass
    ),
    digestUnexpectedCheckpointFailZeroWhenExpectedPass: params.expectedPass
      ? (params.digestSummary?.unexpectedCheckpointGateFailCount ?? -1) === 0
      : true,
    digestRiskNotHighWhenExpectedPass: params.expectedPass
      ? (params.checkpoint.digestSummary !== null && params.checkpoint.digestSummary.riskLevel !== "high")
      : true,
  } as const;
  return buildBooleanGate(checks);
};

const buildCp4ReleaseEvidenceGate = (params: Readonly<{
  releaseReadiness: M6VoiceCp4ReleaseReadinessCaptureBundle;
  expectedPass: boolean;
  longSessionGateEventContexts: ReadonlyArray<Readonly<Record<string, unknown>>>;
  checkpointGateEventContexts: ReadonlyArray<Readonly<Record<string, unknown>>>;
  releaseReadinessGateEventContexts: ReadonlyArray<Readonly<Record<string, unknown>>>;
}>): M6VoiceCp4ReleaseEvidenceBundle["evidenceGate"] => {
  const latestReleaseReadinessEventPass = toBooleanOrNull(
    params.releaseReadinessGateEventContexts.at(-1)?.cp4ReleaseReadinessPass,
  );
  const digestRiskLevel = params.releaseReadiness.digestSummary?.riskLevel;
  const checks = {
    releaseReadinessGateMatchesExpected: (
      params.releaseReadiness.releaseReadinessGate.pass === params.expectedPass
    ),
    longSessionEventObserved: params.longSessionGateEventContexts.length >= 1,
    checkpointEventObserved: params.checkpointGateEventContexts.length >= 1,
    releaseReadinessEventObserved: params.releaseReadinessGateEventContexts.length >= 1,
    latestReleaseReadinessEventMatchesGate: (
      latestReleaseReadinessEventPass === params.releaseReadiness.releaseReadinessGate.pass
    ),
    digestSummaryPresent: params.releaseReadiness.digestSummary !== null,
    digestRiskNotHighWhenExpectedPass: params.expectedPass
      ? (
        digestRiskLevel === "none"
        || digestRiskLevel === "watch"
        || digestRiskLevel === "high"
      )
      : true,
    digestUnexpectedReleaseReadinessFailZeroWhenExpectedPass: params.expectedPass
      ? (
        (params.releaseReadiness.digestSummary?.unexpectedReleaseReadinessGateFailCount ?? -1) === 0
      )
      : true,
  } as const;
  return buildBooleanGate(checks);
};

const buildV120CloseoutGate = (params: Readonly<{
  cp3Suite: M6VoiceReplaySuiteCaptureBundle;
  cp4ReleaseEvidence: M6VoiceCp4ReleaseEvidenceBundle;
  expectedPass: boolean;
}>): M6VoiceV120CloseoutCaptureBundle["closeoutGate"] => {
  const weakDeleteSummary = params.cp3Suite.weakNetwork.capture?.voice.deleteConvergenceSummary ?? null;
  const accountDeleteSummary = params.cp3Suite.accountSwitch.capture?.voice.deleteConvergenceSummary ?? null;
  const longSessionDeleteSummary = (
    params.cp4ReleaseEvidence.releaseReadiness.checkpoint.longSession.capture?.voice.deleteConvergenceSummary
      ?? null
  );
  const digestSummary = params.cp4ReleaseEvidence.releaseReadiness.digestSummary;
  const checks = {
    cp3SuiteGatePass: params.cp3Suite.suiteGate.pass,
    weakNetworkCp2Pass: params.cp3Suite.weakNetwork.cp2EvidenceGate.pass,
    accountSwitchCp2Pass: params.cp3Suite.accountSwitch.cp2EvidenceGate.pass,
    cp4ReleaseEvidenceGateMatchesExpected: params.cp4ReleaseEvidence.evidenceGate.pass === params.expectedPass,
    cp4ReleaseReadinessGateMatchesExpected: (
      params.cp4ReleaseEvidence.releaseReadiness.releaseReadinessGate.pass === params.expectedPass
    ),
    cp4CheckpointGateMatchesExpected: (
      params.cp4ReleaseEvidence.releaseReadiness.checkpoint.cp4CheckpointGate.pass === params.expectedPass
    ),
    weakDeleteSummaryPresent: weakDeleteSummary !== null,
    accountDeleteSummaryPresent: accountDeleteSummary !== null,
    weakDeleteRemoteFailureCountZero: (weakDeleteSummary?.remoteFailedCount ?? -1) === 0,
    accountDeleteRemoteFailureCountZero: (accountDeleteSummary?.remoteFailedCount ?? -1) === 0,
    longSessionDeleteSummaryPresent: longSessionDeleteSummary !== null,
    longSessionDeleteRemoteFailureCountZero: (longSessionDeleteSummary?.remoteFailedCount ?? -1) === 0,
    digestSummaryPresent: digestSummary !== null,
    digestRiskNotHighWhenExpectedPass: params.expectedPass
      ? (
        digestSummary !== null
        && (
          digestSummary.riskLevel !== "high"
          || (
            digestSummary.recoveryExhaustedCount > 0
            && digestSummary.unexpectedLongSessionGateFailCount === 0
            && digestSummary.unexpectedCheckpointGateFailCount === 0
            && digestSummary.unexpectedReleaseReadinessGateFailCount === 0
            && digestSummary.unexpectedReleaseEvidenceGateFailCount === 0
          )
        )
      )
      : true,
    digestUnexpectedReleaseEvidenceFailZeroWhenExpectedPass: params.expectedPass
      ? ((digestSummary?.unexpectedReleaseEvidenceGateFailCount ?? -1) === 0)
      : true,
  } as const;
  return buildBooleanGate(checks);
};

const emitCp4LongSessionGateDiagnostic = (params: Readonly<{
  replay: M6VoiceReplayResult | null;
  replayConfig: M6VoiceLongSessionReplayCaptureBundle["replayConfig"];
  gate: M6VoiceCp4ReadinessGate;
}>): void => {
  const failedChecks = params.gate.failedChecks;
  const finalState = params.replay?.finalState ?? null;
  logAppEvent({
    name: "messaging.realtime_voice.long_session_gate",
    level: params.gate.pass ? "info" : "warn",
    scope: { feature: "messaging", action: "realtime_voice_session" },
    context: {
      cp4Pass: params.gate.pass,
      failedCheckCount: failedChecks.length,
      failedCheckSample: failedChecks.length > 0 ? failedChecks.slice(0, 5).join("|") : null,
      cycleCount: params.replayConfig.cycleCount,
      injectRecoveryExhausted: params.replayConfig.injectRecoveryExhausted,
      finalPhase: finalState?.phase ?? null,
      finalReasonCode: finalState?.lastTransitionReasonCode ?? null,
      transitionEventCount: params.replay?.transitionEventCount ?? 0,
      degradedTransitionCount: params.replay?.degradedTransitionCount ?? 0,
      recoveredActiveTransitionCount: params.replay?.recoveredActiveTransitionCount ?? 0,
      endedTransitionCount: params.replay?.endedTransitionCount ?? 0,
      digestRecoveryExhaustedCount: params.replay?.latestDigestSummary?.recoveryExhaustedCount ?? null,
      digestRiskLevel: params.replay?.latestDigestSummary?.riskLevel ?? null,
      replayReadinessReadyForCp2: params.replay?.replayReadiness?.readyForCp2Evidence === true,
    },
  });
};

const emitConnectingWatchdogGateDiagnostic = (params: Readonly<{
  watchdogGate: M6VoiceConnectingWatchdogGate;
  expectedNoOpenRelay: boolean;
  connectTimeoutEvents: M6VoiceCaptureBundle["voice"]["connectTimeoutEvents"];
  digestSummary: M6VoiceDigestSummary | null;
  latestConnectTimeoutEventContext: Readonly<Record<string, unknown>> | null;
}>): void => {
  const failedChecks = params.watchdogGate.failedChecks;
  const latestEventOpenRelayCount = toNumberOrNull(params.latestConnectTimeoutEventContext?.openRelayCount);
  const latestEventRtcConnectionState = toStringOrNull(params.latestConnectTimeoutEventContext?.rtcConnectionState);
  logAppEvent({
    name: "messaging.realtime_voice.connecting_watchdog_gate",
    level: params.watchdogGate.pass ? "info" : "warn",
    scope: { feature: "messaging", action: "realtime_voice_session" },
    context: {
      watchdogPass: params.watchdogGate.pass,
      expectedNoOpenRelay: params.expectedNoOpenRelay,
      failedCheckCount: failedChecks.length,
      failedCheckSample: failedChecks.length > 0 ? failedChecks.slice(0, 5).join("|") : null,
      connectTimeoutEventCount: params.connectTimeoutEvents.length,
      digestConnectTimeoutDiagnosticsCount: params.digestSummary?.connectTimeoutDiagnosticsCount ?? null,
      digestConnectTimeoutNoOpenRelayCount: params.digestSummary?.connectTimeoutNoOpenRelayCount ?? null,
      latestTimeoutOpenRelayCount: params.digestSummary?.latestConnectTimeoutOpenRelayCount ?? null,
      latestTimeoutRtcConnectionState: params.digestSummary?.latestConnectTimeoutRtcConnectionState ?? null,
      latestEventOpenRelayCount,
      latestEventRtcConnectionState,
    },
  });
};

const emitSyntheticConnectTimeoutDiagnostics = (params: Readonly<{
  openRelayCount: number;
  rtcConnectionState: "new" | "connecting" | "connected" | "failed" | "closed";
}>): void => {
  logAppEvent({
    name: "messaging.realtime_voice.connect_timeout_diagnostics",
    level: "warn",
    scope: { feature: "messaging", action: "realtime_voice_signal" },
    context: {
      roomIdHint: "m6-watchdog-room",
      peerPubkeySuffix: "m6watchdg",
      role: "joiner",
      phase: "connecting",
      openRelayCount: params.openRelayCount,
      configuredRelayCount: 2,
      joinRequestRetryAttempts: 1,
      offerRetryAttempts: 0,
      hasActiveSession: false,
      activeSessionRole: null,
      rtcConnectionState: params.rtcConnectionState,
      hasLocalDescription: false,
      hasRemoteDescription: false,
    },
  });
};

const emitCp4CheckpointGateDiagnostic = (params: Readonly<{
  cp4CheckpointGate: M6VoiceCp4CheckpointCaptureBundle["cp4CheckpointGate"];
  expectedPass: boolean;
  longSession: M6VoiceLongSessionReplayCaptureBundle;
  digestSummary: M6VoiceDigestSummary | null;
}>): void => {
  const failedChecks = params.cp4CheckpointGate.failedChecks;
  logAppEvent({
    name: "messaging.realtime_voice.cp4_checkpoint_gate",
    level: params.cp4CheckpointGate.pass ? "info" : "warn",
    scope: { feature: "messaging", action: "realtime_voice_session" },
    context: {
      cp4CheckpointPass: params.cp4CheckpointGate.pass,
      expectedPass: params.expectedPass,
      failedCheckCount: failedChecks.length,
      failedCheckSample: failedChecks.length > 0 ? failedChecks.slice(0, 5).join("|") : null,
      longSessionGatePass: params.cp4CheckpointGate.checks.longSessionGatePass,
      gateProbePass: params.cp4CheckpointGate.checks.gateProbePass,
      selfTestGatePass: params.cp4CheckpointGate.checks.selfTestGatePass,
      digestRiskNotHigh: params.cp4CheckpointGate.checks.digestRiskNotHigh,
      digestUnexpectedGateFailZero: params.cp4CheckpointGate.checks.digestUnexpectedGateFailZero,
      digestRiskLevel: params.digestSummary?.riskLevel ?? null,
      digestUnexpectedLongSessionGateFailCount: params.digestSummary?.unexpectedLongSessionGateFailCount ?? null,
      cycleCount: params.longSession.replayConfig.cycleCount,
      injectRecoveryExhausted: params.longSession.replayConfig.injectRecoveryExhausted,
    },
  });
};

const emitCp4ReleaseReadinessGateDiagnostic = (params: Readonly<{
  releaseReadinessGate: M6VoiceCp4ReleaseReadinessCaptureBundle["releaseReadinessGate"];
  checkpoint: M6VoiceCp4CheckpointCaptureBundle;
  expectedPass: boolean;
  digestSummary: M6VoiceDigestSummary | null;
}>): void => {
  const failedChecks = params.releaseReadinessGate.failedChecks;
  logAppEvent({
    name: "messaging.realtime_voice.cp4_release_readiness_gate",
    level: params.releaseReadinessGate.pass ? "info" : "warn",
    scope: { feature: "messaging", action: "realtime_voice_session" },
    context: {
      cp4ReleaseReadinessPass: params.releaseReadinessGate.pass,
      expectedPass: params.expectedPass,
      failedCheckCount: failedChecks.length,
      failedCheckSample: failedChecks.length > 0 ? failedChecks.slice(0, 5).join("|") : null,
      checkpointGatePass: params.checkpoint.cp4CheckpointGate.pass,
      checkpointEventObserved: params.releaseReadinessGate.checks.checkpointGateEventObserved,
      digestSummaryPresent: params.releaseReadinessGate.checks.digestSummaryPresent,
      digestCheckpointGateCountObserved: params.releaseReadinessGate.checks.digestCheckpointGateCountObserved,
      digestLatestCheckpointAligned: params.releaseReadinessGate.checks.digestLatestCheckpointAligned,
      digestUnexpectedCheckpointFailZeroWhenExpectedPass: params.releaseReadinessGate.checks.digestUnexpectedCheckpointFailZeroWhenExpectedPass,
      digestRiskNotHighWhenExpectedPass: params.releaseReadinessGate.checks.digestRiskNotHighWhenExpectedPass,
      digestRiskLevel: params.digestSummary?.riskLevel ?? null,
      digestCheckpointGateCount: params.digestSummary?.checkpointGateCount ?? null,
      digestLatestCheckpointGatePass: params.digestSummary?.latestCheckpointGatePass ?? null,
      digestUnexpectedCheckpointGateFailCount: params.digestSummary?.unexpectedCheckpointGateFailCount ?? null,
      cycleCount: params.checkpoint.longSession.replayConfig.cycleCount,
      injectRecoveryExhausted: params.checkpoint.longSession.replayConfig.injectRecoveryExhausted,
    },
  });
};

const emitCp4ReleaseEvidenceGateDiagnostic = (params: Readonly<{
  evidenceGate: M6VoiceCp4ReleaseEvidenceBundle["evidenceGate"];
  releaseReadiness: M6VoiceCp4ReleaseReadinessCaptureBundle;
  expectedPass: boolean;
  eventSliceLimit: number;
}>): void => {
  const failedChecks = params.evidenceGate.failedChecks;
  logAppEvent({
    name: "messaging.realtime_voice.cp4_release_evidence_gate",
    level: params.evidenceGate.pass ? "info" : "warn",
    scope: { feature: "messaging", action: "realtime_voice_session" },
    context: {
      cp4ReleaseEvidencePass: params.evidenceGate.pass,
      expectedPass: params.expectedPass,
      failedCheckCount: failedChecks.length,
      failedCheckSample: failedChecks.length > 0 ? failedChecks.slice(0, 5).join("|") : null,
      releaseReadinessGatePass: params.releaseReadiness.releaseReadinessGate.pass,
      longSessionEventObserved: params.evidenceGate.checks.longSessionEventObserved,
      checkpointEventObserved: params.evidenceGate.checks.checkpointEventObserved,
      releaseReadinessEventObserved: params.evidenceGate.checks.releaseReadinessEventObserved,
      latestReleaseReadinessEventMatchesGate: params.evidenceGate.checks.latestReleaseReadinessEventMatchesGate,
      digestSummaryPresent: params.evidenceGate.checks.digestSummaryPresent,
      digestRiskNotHighWhenExpectedPass: params.evidenceGate.checks.digestRiskNotHighWhenExpectedPass,
      digestUnexpectedReleaseReadinessFailZeroWhenExpectedPass: params.evidenceGate.checks.digestUnexpectedReleaseReadinessFailZeroWhenExpectedPass,
      digestRiskLevel: params.releaseReadiness.digestSummary?.riskLevel ?? null,
      digestUnexpectedReleaseReadinessGateFailCount: params.releaseReadiness.digestSummary?.unexpectedReleaseReadinessGateFailCount ?? null,
      eventSliceLimit: params.eventSliceLimit,
      cycleCount: params.releaseReadiness.checkpoint.longSession.replayConfig.cycleCount,
      injectRecoveryExhausted: params.releaseReadiness.checkpoint.longSession.replayConfig.injectRecoveryExhausted,
    },
  });
};

const emitV120CloseoutGateDiagnostic = (params: Readonly<{
  closeoutGate: M6VoiceV120CloseoutCaptureBundle["closeoutGate"];
  cp3Suite: M6VoiceReplaySuiteCaptureBundle;
  cp4ReleaseEvidence: M6VoiceCp4ReleaseEvidenceBundle;
  expectedPass: boolean;
}>): void => {
  const failedChecks = params.closeoutGate.failedChecks;
  const digestSummary = params.cp4ReleaseEvidence.releaseReadiness.digestSummary;
  const weakDeleteSummary = params.cp3Suite.weakNetwork.capture?.voice.deleteConvergenceSummary ?? null;
  const accountDeleteSummary = params.cp3Suite.accountSwitch.capture?.voice.deleteConvergenceSummary ?? null;
  const longSessionDeleteSummary = (
    params.cp4ReleaseEvidence.releaseReadiness.checkpoint.longSession.capture?.voice.deleteConvergenceSummary
      ?? null
  );
  logAppEvent({
    name: "messaging.realtime_voice.v120_closeout_gate",
    level: params.closeoutGate.pass ? "info" : "warn",
    scope: { feature: "messaging", action: "realtime_voice_session" },
    context: {
      closeoutPass: params.closeoutGate.pass,
      expectedPass: params.expectedPass,
      failedCheckCount: failedChecks.length,
      failedCheckSample: failedChecks.length > 0 ? failedChecks.slice(0, 5).join("|") : null,
      cp3SuitePass: params.cp3Suite.suiteGate.pass,
      weakNetworkCp2Pass: params.cp3Suite.weakNetwork.cp2EvidenceGate.pass,
      accountSwitchCp2Pass: params.cp3Suite.accountSwitch.cp2EvidenceGate.pass,
      cp4ReleaseEvidencePass: params.cp4ReleaseEvidence.evidenceGate.pass,
      cp4ReleaseReadinessPass: params.cp4ReleaseEvidence.releaseReadiness.releaseReadinessGate.pass,
      cp4CheckpointPass: params.cp4ReleaseEvidence.releaseReadiness.checkpoint.cp4CheckpointGate.pass,
      weakDeleteRemoteFailureCount: weakDeleteSummary?.remoteFailedCount ?? null,
      accountDeleteRemoteFailureCount: accountDeleteSummary?.remoteFailedCount ?? null,
      longSessionDeleteRemoteFailureCount: longSessionDeleteSummary?.remoteFailedCount ?? null,
      digestRiskLevel: digestSummary?.riskLevel ?? null,
      digestUnexpectedReleaseEvidenceGateFailCount: digestSummary?.unexpectedReleaseEvidenceGateFailCount ?? null,
      eventSliceLimit: params.cp4ReleaseEvidence.longSessionGateEventContexts.length,
    },
  });
};

const buildReplaySuiteGate = (params: Readonly<{
  weakNetwork: M6VoiceReplayCaptureBundle;
  accountSwitch: M6VoiceReplayCaptureBundle;
}>): M6VoiceReplaySuiteCaptureBundle["suiteGate"] => {
  const weakAsyncVoiceSummary = params.weakNetwork.capture?.voice.asyncVoiceNoteSummary ?? null;
  const accountAsyncVoiceSummary = params.accountSwitch.capture?.voice.asyncVoiceNoteSummary ?? null;
  const weakDeleteSummary = params.weakNetwork.capture?.voice.deleteConvergenceSummary ?? null;
  const accountDeleteSummary = params.accountSwitch.capture?.voice.deleteConvergenceSummary ?? null;
  const checks = {
    weakNetworkPass: params.weakNetwork.cp2EvidenceGate.pass,
    accountSwitchPass: params.accountSwitch.cp2EvidenceGate.pass,
    weakNetworkReadyForCp2: params.weakNetwork.replay?.replayReadiness.readyForCp2Evidence === true,
    accountSwitchReadyForCp2: params.accountSwitch.replay?.replayReadiness.readyForCp2Evidence === true,
    weakAsyncVoiceSummaryPresent: weakAsyncVoiceSummary !== null,
    accountAsyncVoiceSummaryPresent: accountAsyncVoiceSummary !== null,
    weakDeleteSummaryPresent: weakDeleteSummary !== null,
    accountDeleteSummaryPresent: accountDeleteSummary !== null,
    weakAsyncVoiceRiskNotHigh: weakAsyncVoiceSummary !== null
      && weakAsyncVoiceSummary.riskLevel !== "high",
    accountAsyncVoiceRiskNotHigh: accountAsyncVoiceSummary !== null
      && accountAsyncVoiceSummary.riskLevel !== "high",
    weakDeleteRiskNotHigh: weakDeleteSummary !== null
      && weakDeleteSummary.riskLevel !== "high",
    accountDeleteRiskNotHigh: accountDeleteSummary !== null
      && accountDeleteSummary.riskLevel !== "high",
    weakAsyncVoiceStartFailureCountZero: (weakAsyncVoiceSummary?.recordingStartFailedCount ?? -1) === 0,
    accountAsyncVoiceStartFailureCountZero: (accountAsyncVoiceSummary?.recordingStartFailedCount ?? -1) === 0,
    weakDeleteRemoteFailureCountZero: (weakDeleteSummary?.remoteFailedCount ?? -1) === 0,
    accountDeleteRemoteFailureCountZero: (accountDeleteSummary?.remoteFailedCount ?? -1) === 0,
  } as const;
  const failedChecks = Object.entries(checks)
    .filter(([, pass]) => pass !== true)
    .map(([name]) => name);
  return {
    pass: failedChecks.length === 0,
    failedChecks,
    checks,
  };
};

const buildUnsupportedProbeGate = (params: Readonly<{
  finalState: RealtimeVoiceSessionState;
  transitionEvents: ReadonlyArray<Readonly<{ context?: Readonly<Record<string, unknown>> }>>;
  latestDigestSummary: M6VoiceDigestSummary | null;
}>): M6VoiceReplayUnsupportedProbeGate => {
  const latestTransition = getLatestTransitionEvent(params.transitionEvents);
  const latestReasonCode = toStringOrNull(latestTransition?.context?.reasonCode);
  const checks = {
    finalPhaseUnsupported: params.finalState.phase === "unsupported",
    transitionToUnsupportedObserved: countTransitionsToPhase(params.transitionEvents, "unsupported") >= 1,
    digestUnsupportedCountObserved: (params.latestDigestSummary?.unsupportedCount ?? 0) >= 1,
    latestReasonIsUnsupported: latestReasonCode !== null
      && SUPPORTED_UNSUPPORTED_REASON_CODES.has(latestReasonCode),
  } as const;
  return buildBooleanGate(checks);
};

const buildRecoveryExhaustedProbeGate = (params: Readonly<{
  finalState: RealtimeVoiceSessionState;
  transitionEvents: ReadonlyArray<Readonly<{ context?: Readonly<Record<string, unknown>> }>>;
  latestDigestSummary: M6VoiceDigestSummary | null;
}>): M6VoiceReplayRecoveryExhaustedProbeGate => {
  const endedWithRecoveryExhaustedObserved = params.transitionEvents.some((event) => (
    toStringOrNull(event.context?.toPhase) === "ended"
    && toStringOrNull(event.context?.reasonCode) === "recovery_exhausted"
  ));
  const checks = {
    finalPhaseEnded: params.finalState.phase === "ended",
    finalReasonRecoveryExhausted: params.finalState.lastTransitionReasonCode === "recovery_exhausted",
    transitionToEndedObserved: countTransitionsToPhase(params.transitionEvents, "ended") >= 1,
    endedReasonRecoveryExhaustedObserved: endedWithRecoveryExhaustedObserved,
    digestRecoveryExhaustedCountObserved: (params.latestDigestSummary?.recoveryExhaustedCount ?? 0) >= 1,
  } as const;
  return buildBooleanGate(checks);
};

const buildReplayResult = (params: Readonly<{
  scenario: M6VoiceReplayScenario;
  replayBaseUnixMs: number;
  finalState: RealtimeVoiceSessionState;
  transitionEvents: ReadonlyArray<Readonly<{ context?: Readonly<Record<string, unknown>> }>>;
  ignoredEvents: ReadonlyArray<Readonly<{ context?: Readonly<Record<string, unknown>> }>>;
  latestDigestSummary: M6VoiceDigestSummary | null;
  secondRoomIdHint?: string | null;
}>): M6VoiceReplayResult => {
  const degradedTransitionCount = countTransitionsToPhase(params.transitionEvents, "degraded");
  const recoveredActiveTransitionCount = countRecoveredActiveTransitions(params.transitionEvents);
  const endedTransitionCount = countTransitionsToPhase(params.transitionEvents, "ended");
  const roomHintCount = countDistinctRoomHints(params.transitionEvents);
  const postSwitchActiveTransitionCount = params.scenario === "account_switch"
    ? countTransitionsByRoomAndPhase(params.transitionEvents, {
      roomIdHint: params.secondRoomIdHint ?? null,
      toPhase: "active",
    })
    : 0;
  return {
    scenario: params.scenario,
    generatedAtUnixMs: Date.now(),
    replayBaseUnixMs: params.replayBaseUnixMs,
    finalState: params.finalState,
    transitionEventCount: params.transitionEvents.length,
    degradedTransitionCount,
    recoveredActiveTransitionCount,
    endedTransitionCount,
    roomHintCount,
    ignoredEventCount: params.ignoredEvents.length,
    latestDigestSummary: params.latestDigestSummary,
    replayReadiness: buildReplayReadiness({
      scenario: params.scenario,
      transitionEventCount: params.transitionEvents.length,
      degradedTransitionCount,
      recoveredActiveTransitionCount,
      endedTransitionCount,
      roomHintCount,
      postSwitchActiveTransitionCount,
      latestDigestSummary: params.latestDigestSummary,
    }),
  };
};

export const installM6VoiceReplayBridge = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const root = window as M6VoiceReplayWindow;
  if (
    root.obscurM6VoiceReplay
    && typeof root.obscurM6VoiceReplay.runCp4CheckpointCapture === "function"
    && typeof root.obscurM6VoiceReplay.runCp4CheckpointCaptureJson === "function"
    && typeof root.obscurM6VoiceReplay.runCp4CheckpointGateProbe === "function"
    && typeof root.obscurM6VoiceReplay.runCp4CheckpointGateProbeJson === "function"
    && typeof root.obscurM6VoiceReplay.runCp4ReleaseReadinessCapture === "function"
    && typeof root.obscurM6VoiceReplay.runCp4ReleaseReadinessCaptureJson === "function"
    && typeof root.obscurM6VoiceReplay.runCp4ReleaseReadinessGateProbe === "function"
    && typeof root.obscurM6VoiceReplay.runCp4ReleaseReadinessGateProbeJson === "function"
    && typeof root.obscurM6VoiceReplay.runCp4ReleaseEvidenceCapture === "function"
    && typeof root.obscurM6VoiceReplay.runCp4ReleaseEvidenceCaptureJson === "function"
    && typeof root.obscurM6VoiceReplay.runCp4ReleaseEvidenceGateProbe === "function"
    && typeof root.obscurM6VoiceReplay.runCp4ReleaseEvidenceGateProbeJson === "function"
    && typeof root.obscurM6VoiceReplay.runV120CloseoutCapture === "function"
    && typeof root.obscurM6VoiceReplay.runV120CloseoutCaptureJson === "function"
    && typeof root.obscurM6VoiceReplay.runV120CloseoutGateProbe === "function"
    && typeof root.obscurM6VoiceReplay.runV120CloseoutGateProbeJson === "function"
    && typeof root.obscurM6VoiceReplay.runCp4LongSessionGateProbe === "function"
    && typeof root.obscurM6VoiceReplay.runCp4LongSessionGateProbeJson === "function"
    && typeof root.obscurM6VoiceReplay.runCp4LongSessionSelfTest === "function"
    && typeof root.obscurM6VoiceReplay.runLongSessionReplayCapture === "function"
    && typeof root.obscurM6VoiceReplay.runConnectingWatchdogCapture === "function"
    && typeof root.obscurM6VoiceReplay.runConnectingWatchdogCaptureJson === "function"
    && typeof root.obscurM6VoiceReplay.runConnectingWatchdogGateProbe === "function"
    && typeof root.obscurM6VoiceReplay.runConnectingWatchdogGateProbeJson === "function"
    && typeof root.obscurM6VoiceReplay.runConnectingWatchdogSelfTest === "function"
    && typeof root.obscurM6VoiceReplay.runConnectingWatchdogSelfTestJson === "function"
  ) {
    return;
  }

  let state = createInitialRealtimeVoiceSessionState();
  let clockUnixMs = 0;
  const owner = createRealtimeVoiceSessionOwner();
  let lastReplay: M6VoiceReplayResult | null = null;
  const nextEventUnixMs = (): number => {
    clockUnixMs += 100;
    return clockUnixMs;
  };
  const syncFromOwner = (): RealtimeVoiceSessionState => {
    state = owner.getState();
    return state;
  };

  root.obscurM6VoiceReplay = {
    reset: (options) => {
      clockUnixMs = 0;
      state = owner.reset(options);
      lastReplay = null;
      return syncFromOwner();
    },
    getState: () => state,
    getLastReplay: () => lastReplay,
    start: (params) => {
      const supported = params?.supported !== false;
      const capability = supported
        ? {
          supported: true as const,
          reasonCode: "supported" as const,
          isSecureContext: true,
          hasMediaDevices: true,
          hasPeerConnection: true,
          hasAddTrack: true,
          opusCapabilityStatus: params?.opusCapabilityStatus ?? "available",
        }
        : {
          supported: false as const,
          reasonCode: params?.unsupportedReasonCode ?? "webrtc_unavailable",
          isSecureContext: true,
          hasMediaDevices: true,
          hasPeerConnection: false,
          hasAddTrack: false,
          opusCapabilityStatus: "unknown" as const,
        };
      state = owner.start({
        roomId: params?.roomId ?? "m6-voice-room",
        mode: params?.mode ?? "join",
        capability,
        maxRecoveryAttempts: params?.maxRecoveryAttempts,
        eventUnixMs: nextEventUnixMs(),
      });
      return syncFromOwner();
    },
    connect: (params) => {
      state = owner.connected({
        participantCount: params?.participantCount ?? 2,
        hasPeerSessionEvidence: params?.hasPeerSessionEvidence ?? true,
        eventUnixMs: nextEventUnixMs(),
      });
      return syncFromOwner();
    },
    degrade: (params) => {
      state = owner.transportDegraded({
        reasonCode: params?.reasonCode ?? "network_degraded",
        eventUnixMs: nextEventUnixMs(),
      });
      return syncFromOwner();
    },
    requestRecovery: () => {
      state = owner.requestRecovery({
        eventUnixMs: nextEventUnixMs(),
      });
      return syncFromOwner();
    },
    failRecovery: (params) => {
      state = owner.recoveryFailed({
        reasonCode: params?.reasonCode ?? "transport_timeout",
        eventUnixMs: nextEventUnixMs(),
      });
      return syncFromOwner();
    },
    leave: () => {
      state = owner.requestLeave({
        eventUnixMs: nextEventUnixMs(),
      });
      return syncFromOwner();
    },
    end: (params) => {
      state = owner.left({
        reasonCode: params?.reasonCode ?? "left_by_user",
        eventUnixMs: nextEventUnixMs(),
      });
      return syncFromOwner();
    },
    runWeakNetworkReplay: (params) => {
      if (params?.clearAppEvents) {
        root.obscurAppEvents?.clear?.();
      }
      const replayBaseUnixMs = typeof params?.baseUnixMs === "number" && Number.isFinite(params.baseUnixMs)
        ? Math.floor(params.baseUnixMs)
        : Date.now();
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      clockUnixMs = replayBaseUnixMs;
      state = owner.reset({
        maxRecoveryAttempts: params?.maxRecoveryAttempts,
      });
      root.obscurM6VoiceReplay?.start({
        roomId: params?.roomId ?? "m6-voice-room",
        mode: params?.mode ?? "join",
        supported: true,
        maxRecoveryAttempts: params?.maxRecoveryAttempts,
      });
      root.obscurM6VoiceReplay?.connect({
        participantCount: 2,
        hasPeerSessionEvidence: true,
      });
      root.obscurM6VoiceReplay?.degrade({ reasonCode: "network_degraded" });
      root.obscurM6VoiceReplay?.requestRecovery();
      root.obscurM6VoiceReplay?.connect({
        participantCount: 2,
        hasPeerSessionEvidence: true,
      });
      const transitions = readEventsByName(
        root,
        "messaging.realtime_voice.session_transition",
        captureWindowSize,
      );
      const ignoredEvents = readEventsByName(
        root,
        "messaging.realtime_voice.session_event_ignored",
        captureWindowSize,
      );
      const latestDigestSummary = readDigestSummary(root, captureWindowSize);
      lastReplay = buildReplayResult({
        scenario: "weak_network",
        replayBaseUnixMs,
        finalState: state,
        transitionEvents: transitions,
        ignoredEvents,
        latestDigestSummary,
      });
      return state;
    },
    runWeakNetworkReplayCapture: (params) => {
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      root.obscurM6VoiceReplay?.runWeakNetworkReplay({
        ...params,
        captureWindowSize,
      });
      const replay = lastReplay;
      const capture = root.obscurM6VoiceCapture?.capture?.(captureWindowSize) ?? null;
      return {
        replay,
        capture,
        cp2EvidenceGate: buildCp2EvidenceGate(replay, capture),
      };
    },
    runWeakNetworkReplayCaptureJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runWeakNetworkReplayCapture(params) ?? null,
        null,
        2,
      )
    ),
    runAccountSwitchReplay: (params) => {
      if (params?.clearAppEvents) {
        root.obscurAppEvents?.clear?.();
      }
      const replayBaseUnixMs = typeof params?.baseUnixMs === "number" && Number.isFinite(params.baseUnixMs)
        ? Math.floor(params.baseUnixMs)
        : Date.now();
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      const firstRoomId = params?.firstRoomId ?? "m6-room-account-switch-a-0001";
      const secondRoomId = params?.secondRoomId ?? "m6-room-account-switch-b-0002";
      const secondRoomIdHint = toRoomIdHint(secondRoomId);
      clockUnixMs = replayBaseUnixMs;
      state = owner.reset({
        maxRecoveryAttempts: params?.maxRecoveryAttempts,
      });
      root.obscurM6VoiceReplay?.start({
        roomId: firstRoomId,
        mode: params?.mode ?? "join",
        supported: true,
        maxRecoveryAttempts: params?.maxRecoveryAttempts,
      });
      root.obscurM6VoiceReplay?.connect({
        participantCount: 2,
        hasPeerSessionEvidence: true,
      });
      root.obscurM6VoiceReplay?.leave();
      root.obscurM6VoiceReplay?.end({ reasonCode: "left_by_user" });
      root.obscurM6VoiceReplay?.start({
        roomId: secondRoomId,
        mode: params?.mode ?? "join",
        supported: true,
        maxRecoveryAttempts: params?.maxRecoveryAttempts,
      });
      root.obscurM6VoiceReplay?.connect({
        participantCount: 2,
        hasPeerSessionEvidence: true,
      });
      const transitions = readEventsByName(
        root,
        "messaging.realtime_voice.session_transition",
        captureWindowSize,
      );
      const ignoredEvents = readEventsByName(
        root,
        "messaging.realtime_voice.session_event_ignored",
        captureWindowSize,
      );
      const latestDigestSummary = readDigestSummary(root, captureWindowSize);
      lastReplay = buildReplayResult({
        scenario: "account_switch",
        replayBaseUnixMs,
        finalState: state,
        transitionEvents: transitions,
        ignoredEvents,
        latestDigestSummary,
        secondRoomIdHint,
      });
      return state;
    },
    runAccountSwitchReplayCapture: (params) => {
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      root.obscurM6VoiceReplay?.runAccountSwitchReplay({
        ...params,
        captureWindowSize,
      });
      const replay = lastReplay;
      const capture = root.obscurM6VoiceCapture?.capture?.(captureWindowSize) ?? null;
      return {
        replay,
        capture,
        cp2EvidenceGate: buildCp2EvidenceGate(replay, capture),
      };
    },
    runAccountSwitchReplayCaptureJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runAccountSwitchReplayCapture(params) ?? null,
        null,
        2,
      )
    ),
    runLongSessionReplay: (params) => {
      if (params?.clearAppEvents) {
        root.obscurAppEvents?.clear?.();
      }
      const replayBaseUnixMs = typeof params?.baseUnixMs === "number" && Number.isFinite(params.baseUnixMs)
        ? Math.floor(params.baseUnixMs)
        : Date.now();
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      const cycleCount = toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT);
      const injectRecoveryExhausted = params?.injectRecoveryExhausted === true;
      const resolvedMaxRecoveryAttempts = params?.maxRecoveryAttempts ?? (injectRecoveryExhausted ? 2 : 8);

      clockUnixMs = replayBaseUnixMs;
      state = owner.reset({
        maxRecoveryAttempts: resolvedMaxRecoveryAttempts,
      });
      root.obscurM6VoiceReplay?.start({
        roomId: params?.roomId ?? "m6-voice-room-long-session",
        mode: params?.mode ?? "join",
        supported: true,
        maxRecoveryAttempts: resolvedMaxRecoveryAttempts,
      });
      root.obscurM6VoiceReplay?.connect({
        participantCount: 2,
        hasPeerSessionEvidence: true,
      });

      for (let cycleIndex = 0; cycleIndex < cycleCount; cycleIndex += 1) {
        if (state.phase === "ended") {
          break;
        }
        root.obscurM6VoiceReplay?.degrade({ reasonCode: "network_degraded" });
        root.obscurM6VoiceReplay?.requestRecovery();
        if (injectRecoveryExhausted) {
          root.obscurM6VoiceReplay?.failRecovery({ reasonCode: "transport_timeout" });
          continue;
        }
        root.obscurM6VoiceReplay?.connect({
          participantCount: 2,
          hasPeerSessionEvidence: true,
        });
      }

      if (!injectRecoveryExhausted && state.phase !== "active") {
        root.obscurM6VoiceReplay?.connect({
          participantCount: 2,
          hasPeerSessionEvidence: true,
        });
      }

      const transitions = readEventsByName(
        root,
        "messaging.realtime_voice.session_transition",
        captureWindowSize,
      );
      const ignoredEvents = readEventsByName(
        root,
        "messaging.realtime_voice.session_event_ignored",
        captureWindowSize,
      );
      const latestDigestSummary = readDigestSummary(root, captureWindowSize);
      lastReplay = buildReplayResult({
        scenario: "weak_network",
        replayBaseUnixMs,
        finalState: state,
        transitionEvents: transitions,
        ignoredEvents,
        latestDigestSummary,
      });
      return state;
    },
    runLongSessionReplayCapture: (params) => {
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      const cycleCount = toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT);
      const injectRecoveryExhausted = params?.injectRecoveryExhausted === true;
      root.obscurM6VoiceReplay?.runLongSessionReplay({
        ...params,
        captureWindowSize,
        cycleCount,
      });
      const replay = lastReplay;
      const capture = root.obscurM6VoiceCapture?.capture?.(captureWindowSize) ?? null;
      const replayConfig = {
        cycleCount,
        injectRecoveryExhausted,
      } as const;
      const cp4ReadinessGate = buildCp4ReadinessGate({
        replay,
        capture,
        cycleCount,
      });
      emitCp4LongSessionGateDiagnostic({
        replay,
        replayConfig,
        gate: cp4ReadinessGate,
      });
      return {
        replay,
        capture,
        replayConfig,
        cp4ReadinessGate,
      };
    },
    runLongSessionReplayCaptureJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runLongSessionReplayCapture(params) ?? null,
        null,
        2,
      )
    ),
    runConnectingWatchdogCapture: (params) => {
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      if (params?.clearAppEvents === true) {
        root.obscurAppEvents?.clear?.();
      }
      const capture = root.obscurM6VoiceCapture?.capture?.(captureWindowSize) ?? null;
      const digestSummary = capture?.voice.summary ?? readDigestSummary(root, captureWindowSize);
      const connectTimeoutEvents = capture?.voice.connectTimeoutEvents ?? [];
      const latestConnectTimeoutEventContext = connectTimeoutEvents.at(-1)?.context ?? null;
      const expectedNoOpenRelay = params?.expectedNoOpenRelay === true;
      const watchdogGate = buildConnectingWatchdogGate({
        capture,
        digestSummary,
        connectTimeoutEvents,
        latestConnectTimeoutEventContext,
        expectedNoOpenRelay,
      });
      emitConnectingWatchdogGateDiagnostic({
        watchdogGate,
        expectedNoOpenRelay,
        connectTimeoutEvents,
        digestSummary,
        latestConnectTimeoutEventContext,
      });
      return {
        generatedAtUnixMs: Date.now(),
        captureWindowSize,
        expectedNoOpenRelay,
        capture,
        digestSummary,
        connectTimeoutEvents,
        latestConnectTimeoutEventContext,
        watchdogGate,
      };
    },
    runConnectingWatchdogCaptureJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runConnectingWatchdogCapture(params) ?? null,
        null,
        2,
      )
    ),
    runConnectingWatchdogGateProbe: (params) => (
      root.obscurM6VoiceReplay?.runConnectingWatchdogCapture(params)?.watchdogGate ?? {
        pass: false,
        failedChecks: ["connecting_watchdog_capture_unavailable"],
        checks: EMPTY_CONNECTING_WATCHDOG_GATE_CHECKS,
      }
    ),
    runConnectingWatchdogGateProbeJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runConnectingWatchdogGateProbe(params) ?? null,
        null,
        2,
      )
    ),
    runConnectingWatchdogSelfTest: (params) => {
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      if (params?.clearAppEvents === true) {
        root.obscurAppEvents?.clear?.();
      }

      root.obscurAppEvents?.clear?.();
      emitSyntheticConnectTimeoutDiagnostics({
        openRelayCount: 0,
        rtcConnectionState: "connecting",
      });
      const noOpenRelayExpected = root.obscurM6VoiceReplay?.runConnectingWatchdogCapture({
        captureWindowSize,
        expectedNoOpenRelay: true,
      }) ?? {
        generatedAtUnixMs: Date.now(),
        captureWindowSize,
        expectedNoOpenRelay: true,
        capture: null,
        digestSummary: null,
        connectTimeoutEvents: [],
        latestConnectTimeoutEventContext: null,
        watchdogGate: {
          pass: false,
          failedChecks: ["connecting_watchdog_capture_unavailable"],
          checks: EMPTY_CONNECTING_WATCHDOG_GATE_CHECKS,
        },
      };

      root.obscurAppEvents?.clear?.();
      emitSyntheticConnectTimeoutDiagnostics({
        openRelayCount: 2,
        rtcConnectionState: "new",
      });
      const openRelayUnexpected = root.obscurM6VoiceReplay?.runConnectingWatchdogCapture({
        captureWindowSize,
        expectedNoOpenRelay: true,
      }) ?? {
        generatedAtUnixMs: Date.now(),
        captureWindowSize,
        expectedNoOpenRelay: true,
        capture: null,
        digestSummary: null,
        connectTimeoutEvents: [],
        latestConnectTimeoutEventContext: null,
        watchdogGate: {
          pass: false,
          failedChecks: ["connecting_watchdog_capture_unavailable"],
          checks: EMPTY_CONNECTING_WATCHDOG_GATE_CHECKS,
        },
      };

      return {
        generatedAtUnixMs: Date.now(),
        noOpenRelayExpected,
        openRelayUnexpected,
        selfTestGate: buildConnectingWatchdogSelfTestGate({
          noOpenRelayExpected,
          openRelayUnexpected,
        }),
      };
    },
    runConnectingWatchdogSelfTestJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runConnectingWatchdogSelfTest(params) ?? null,
        null,
        2,
      )
    ),
    runCp4LongSessionGateProbe: (params) => {
      const capture = root.obscurM6VoiceReplay?.runLongSessionReplayCapture(params) ?? null;
      const expectedPass = typeof params?.expectedPass === "boolean"
        ? params.expectedPass
        : params?.injectRecoveryExhausted !== true;
      const latestGateEvent = root.obscurAppEvents?.findByName?.(
        "messaging.realtime_voice.long_session_gate",
        1,
      )?.at(-1) ?? null;
      return buildCp4LongSessionGateProbe({
        capture,
        expectedPass,
        latestGateEventContext: latestGateEvent?.context ?? null,
      });
    },
    runCp4LongSessionGateProbeJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runCp4LongSessionGateProbe(params) ?? null,
        null,
        2,
      )
    ),
    runCp4LongSessionSelfTest: (params) => {
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      const baseUnixMs = typeof params?.baseUnixMs === "number" && Number.isFinite(params.baseUnixMs)
        ? Math.floor(params.baseUnixMs)
        : Date.now();
      const nominalCycleCount = toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT);
      const failureCycleCount = toPositiveInteger(
        params?.failureCycleCount,
        Math.max(3, Math.min(4, nominalCycleCount)),
      );
      const nominal = root.obscurM6VoiceReplay?.runLongSessionReplayCapture({
        clearAppEvents: params?.clearAppEvents,
        captureWindowSize,
        mode: params?.mode,
        cycleCount: nominalCycleCount,
        maxRecoveryAttempts: params?.maxRecoveryAttempts,
        injectRecoveryExhausted: false,
        baseUnixMs,
      }) ?? {
        replay: null,
        capture: null,
        replayConfig: {
          cycleCount: nominalCycleCount,
          injectRecoveryExhausted: false,
        },
        cp4ReadinessGate: buildCp4ReadinessGate({
          replay: null,
          capture: null,
          cycleCount: nominalCycleCount,
        }),
      };
      const failureInjection = root.obscurM6VoiceReplay?.runLongSessionReplayCapture({
        clearAppEvents: true,
        captureWindowSize,
        mode: params?.mode,
        cycleCount: failureCycleCount,
        maxRecoveryAttempts: params?.failureMaxRecoveryAttempts ?? 2,
        injectRecoveryExhausted: true,
        baseUnixMs: baseUnixMs + 20_000,
      }) ?? {
        replay: null,
        capture: null,
        replayConfig: {
          cycleCount: failureCycleCount,
          injectRecoveryExhausted: true,
        },
        cp4ReadinessGate: buildCp4ReadinessGate({
          replay: null,
          capture: null,
          cycleCount: failureCycleCount,
        }),
      };
      return {
        generatedAtUnixMs: Date.now(),
        nominal,
        failureInjection,
        selfTestGate: buildCp4LongSessionSelfTestGate({
          nominal,
          failureInjection,
        }),
      };
    },
    runCp4LongSessionSelfTestJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runCp4LongSessionSelfTest(params) ?? null,
        null,
        2,
      )
    ),
    runCp4CheckpointCapture: (params) => {
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      const baseUnixMs = typeof params?.baseUnixMs === "number" && Number.isFinite(params.baseUnixMs)
        ? Math.floor(params.baseUnixMs)
        : Date.now();
      const cycleCount = toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT);
      const longSession = root.obscurM6VoiceReplay?.runLongSessionReplayCapture({
        clearAppEvents: params?.clearAppEvents,
        captureWindowSize,
        mode: params?.mode,
        cycleCount,
        maxRecoveryAttempts: params?.maxRecoveryAttempts,
        injectRecoveryExhausted: params?.injectRecoveryExhausted,
        baseUnixMs,
      }) ?? {
        replay: null,
        capture: null,
        replayConfig: {
          cycleCount,
          injectRecoveryExhausted: params?.injectRecoveryExhausted === true,
        },
        cp4ReadinessGate: buildCp4ReadinessGate({
          replay: null,
          capture: null,
          cycleCount,
        }),
      };
      const expectedPass = typeof params?.expectedPass === "boolean"
        ? params.expectedPass
        : params?.injectRecoveryExhausted !== true;
      const latestGateEvent = root.obscurAppEvents?.findByName?.(
        "messaging.realtime_voice.long_session_gate",
        1,
      )?.at(-1) ?? null;
      const gateProbe = buildCp4LongSessionGateProbe({
        capture: longSession,
        expectedPass,
        latestGateEventContext: latestGateEvent?.context ?? null,
      });
      const selfTest = root.obscurM6VoiceReplay?.runCp4LongSessionSelfTest({
        clearAppEvents: true,
        captureWindowSize,
        mode: params?.mode,
        baseUnixMs: baseUnixMs + 40_000,
        cycleCount: toPositiveInteger(params?.selfTestCycleCount, cycleCount),
        maxRecoveryAttempts: params?.maxRecoveryAttempts,
        failureCycleCount: params?.selfTestFailureCycleCount,
        failureMaxRecoveryAttempts: params?.selfTestFailureMaxRecoveryAttempts,
      }) ?? {
        generatedAtUnixMs: Date.now(),
        nominal: {
          replay: null,
          capture: null,
          replayConfig: {
            cycleCount,
            injectRecoveryExhausted: false,
          },
          cp4ReadinessGate: buildCp4ReadinessGate({
            replay: null,
            capture: null,
            cycleCount,
          }),
        },
        failureInjection: {
          replay: null,
          capture: null,
          replayConfig: {
            cycleCount: toPositiveInteger(params?.selfTestFailureCycleCount, Math.max(3, Math.min(4, cycleCount))),
            injectRecoveryExhausted: true,
          },
          cp4ReadinessGate: buildCp4ReadinessGate({
            replay: null,
            capture: null,
            cycleCount: toPositiveInteger(params?.selfTestFailureCycleCount, Math.max(3, Math.min(4, cycleCount))),
          }),
        },
        selfTestGate: buildBooleanGate({
          nominalPass: false,
          nominalFinalPhaseActive: false,
          nominalRecoveryExhaustedZero: false,
          failureGateRejected: false,
          failureFinalPhaseEnded: false,
          failureReasonRecoveryExhausted: false,
          failureGateFlagsRecoverySignals: false,
        }),
      };
      const digestSummary = longSession.replay?.latestDigestSummary ?? null;
      const cp4CheckpointGate = buildCp4CheckpointGate({
        longSession,
        gateProbe,
        selfTest,
        digestSummary,
      });
      emitCp4CheckpointGateDiagnostic({
        cp4CheckpointGate,
        expectedPass,
        longSession,
        digestSummary,
      });
      return {
        generatedAtUnixMs: Date.now(),
        longSession,
        gateProbe,
        selfTest,
        digestSummary,
        cp4CheckpointGate,
      };
    },
    runCp4CheckpointCaptureJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runCp4CheckpointCapture(params) ?? null,
        null,
        2,
      )
    ),
    runCp4CheckpointGateProbe: (params) => (
      root.obscurM6VoiceReplay?.runCp4CheckpointCapture(params)?.cp4CheckpointGate ?? {
        pass: false,
        failedChecks: ["cp4_checkpoint_capture_unavailable"],
        checks: EMPTY_CP4_CHECKPOINT_GATE_CHECKS,
      }
    ),
    runCp4CheckpointGateProbeJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runCp4CheckpointGateProbe(params) ?? null,
        null,
        2,
      )
    ),
    runCp4ReleaseReadinessCapture: (params) => {
      const checkpoint = root.obscurM6VoiceReplay?.runCp4CheckpointCapture(params) ?? {
        generatedAtUnixMs: Date.now(),
        longSession: {
          replay: null,
          capture: null,
          replayConfig: {
            cycleCount: toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT),
            injectRecoveryExhausted: params?.injectRecoveryExhausted === true,
          },
          cp4ReadinessGate: buildCp4ReadinessGate({
            replay: null,
            capture: null,
            cycleCount: toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT),
          }),
        },
        gateProbe: buildCp4LongSessionGateProbe({
          capture: null,
          expectedPass: params?.expectedPass === true,
          latestGateEventContext: null,
        }),
        selfTest: {
          generatedAtUnixMs: Date.now(),
          nominal: {
            replay: null,
            capture: null,
            replayConfig: {
              cycleCount: toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT),
              injectRecoveryExhausted: false,
            },
            cp4ReadinessGate: buildCp4ReadinessGate({
              replay: null,
              capture: null,
              cycleCount: toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT),
            }),
          },
          failureInjection: {
            replay: null,
            capture: null,
            replayConfig: {
              cycleCount: toPositiveInteger(params?.selfTestFailureCycleCount, 3),
              injectRecoveryExhausted: true,
            },
            cp4ReadinessGate: buildCp4ReadinessGate({
              replay: null,
              capture: null,
              cycleCount: toPositiveInteger(params?.selfTestFailureCycleCount, 3),
            }),
          },
          selfTestGate: buildBooleanGate({
            nominalPass: false,
            nominalFinalPhaseActive: false,
            nominalRecoveryExhaustedZero: false,
            failureGateRejected: false,
            failureFinalPhaseEnded: false,
            failureReasonRecoveryExhausted: false,
            failureGateFlagsRecoverySignals: false,
          }),
        },
        digestSummary: null,
        cp4CheckpointGate: {
          pass: false,
          failedChecks: ["cp4_checkpoint_capture_unavailable"],
          checks: EMPTY_CP4_CHECKPOINT_GATE_CHECKS,
        },
      };
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      const expectedPass = typeof params?.expectedPass === "boolean"
        ? params.expectedPass
        : params?.injectRecoveryExhausted !== true;
      const latestLongSessionGateEventContext = root.obscurAppEvents?.findByName?.(
        "messaging.realtime_voice.long_session_gate",
        captureWindowSize,
      )?.at(-1)?.context ?? null;
      const latestCheckpointGateEventContext = root.obscurAppEvents?.findByName?.(
        "messaging.realtime_voice.cp4_checkpoint_gate",
        captureWindowSize,
      )?.at(-1)?.context ?? null;
      const digestSummary = readDigestSummary(root, captureWindowSize);
      const releaseReadinessGate = buildCp4ReleaseReadinessGate({
        checkpoint,
        expectedPass,
        latestLongSessionGateEventContext,
        latestCheckpointGateEventContext,
        digestSummary,
      });
      emitCp4ReleaseReadinessGateDiagnostic({
        releaseReadinessGate,
        checkpoint,
        expectedPass,
        digestSummary,
      });
      return {
        generatedAtUnixMs: Date.now(),
        checkpoint,
        latestLongSessionGateEventContext,
        latestCheckpointGateEventContext,
        digestSummary,
        releaseReadinessGate,
      };
    },
    runCp4ReleaseReadinessCaptureJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runCp4ReleaseReadinessCapture(params) ?? null,
        null,
        2,
      )
    ),
    runCp4ReleaseReadinessGateProbe: (params) => (
      root.obscurM6VoiceReplay?.runCp4ReleaseReadinessCapture(params)?.releaseReadinessGate ?? {
        pass: false,
        failedChecks: ["cp4_release_readiness_capture_unavailable"],
        checks: EMPTY_CP4_RELEASE_READINESS_GATE_CHECKS,
      }
    ),
    runCp4ReleaseReadinessGateProbeJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runCp4ReleaseReadinessGateProbe(params) ?? null,
        null,
        2,
      )
    ),
    runCp4ReleaseEvidenceCapture: (params) => {
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      const eventSliceLimit = Math.max(1, Math.min(10, toPositiveInteger(params?.eventSliceLimit, 3)));
      const expectedPass = typeof params?.expectedPass === "boolean"
        ? params.expectedPass
        : params?.injectRecoveryExhausted !== true;
      const releaseReadiness = root.obscurM6VoiceReplay?.runCp4ReleaseReadinessCapture(params) ?? {
        generatedAtUnixMs: Date.now(),
        checkpoint: {
          generatedAtUnixMs: Date.now(),
          longSession: {
            replay: null,
            capture: null,
            replayConfig: {
              cycleCount: toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT),
              injectRecoveryExhausted: params?.injectRecoveryExhausted === true,
            },
            cp4ReadinessGate: buildCp4ReadinessGate({
              replay: null,
              capture: null,
              cycleCount: toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT),
            }),
          },
          gateProbe: buildCp4LongSessionGateProbe({
            capture: null,
            expectedPass,
            latestGateEventContext: null,
          }),
          selfTest: {
            generatedAtUnixMs: Date.now(),
            nominal: {
              replay: null,
              capture: null,
              replayConfig: {
                cycleCount: toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT),
                injectRecoveryExhausted: false,
              },
              cp4ReadinessGate: buildCp4ReadinessGate({
                replay: null,
                capture: null,
                cycleCount: toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT),
              }),
            },
            failureInjection: {
              replay: null,
              capture: null,
              replayConfig: {
                cycleCount: toPositiveInteger(params?.selfTestFailureCycleCount, 3),
                injectRecoveryExhausted: true,
              },
              cp4ReadinessGate: buildCp4ReadinessGate({
                replay: null,
                capture: null,
                cycleCount: toPositiveInteger(params?.selfTestFailureCycleCount, 3),
              }),
            },
            selfTestGate: buildBooleanGate({
              nominalPass: false,
              nominalFinalPhaseActive: false,
              nominalRecoveryExhaustedZero: false,
              failureGateRejected: false,
              failureFinalPhaseEnded: false,
              failureReasonRecoveryExhausted: false,
              failureGateFlagsRecoverySignals: false,
            }),
          },
          digestSummary: null,
          cp4CheckpointGate: {
            pass: false,
            failedChecks: ["cp4_checkpoint_capture_unavailable"],
            checks: EMPTY_CP4_CHECKPOINT_GATE_CHECKS,
          },
        },
        latestLongSessionGateEventContext: null,
        latestCheckpointGateEventContext: null,
        digestSummary: null,
        releaseReadinessGate: {
          pass: false,
          failedChecks: ["cp4_release_readiness_capture_unavailable"],
          checks: EMPTY_CP4_RELEASE_READINESS_GATE_CHECKS,
        },
      };
      const longSessionGateEventContexts = readEventsByName(
        root,
        "messaging.realtime_voice.long_session_gate",
        captureWindowSize,
      )
        .slice(-eventSliceLimit)
        .map((event) => event.context ?? {});
      const checkpointGateEventContexts = readEventsByName(
        root,
        "messaging.realtime_voice.cp4_checkpoint_gate",
        captureWindowSize,
      )
        .slice(-eventSliceLimit)
        .map((event) => event.context ?? {});
      const releaseReadinessGateEventContexts = readEventsByName(
        root,
        "messaging.realtime_voice.cp4_release_readiness_gate",
        captureWindowSize,
      )
        .slice(-eventSliceLimit)
        .map((event) => event.context ?? {});
      const recentWarnOrError = readRecentWarnOrError(root, captureWindowSize, eventSliceLimit);
      const evidenceGate = buildCp4ReleaseEvidenceGate({
        releaseReadiness,
        expectedPass,
        longSessionGateEventContexts,
        checkpointGateEventContexts,
        releaseReadinessGateEventContexts,
      });
      emitCp4ReleaseEvidenceGateDiagnostic({
        evidenceGate,
        releaseReadiness,
        expectedPass,
        eventSliceLimit,
      });
      return {
        generatedAtUnixMs: Date.now(),
        releaseReadiness,
        longSessionGateEventContexts,
        checkpointGateEventContexts,
        releaseReadinessGateEventContexts,
        recentWarnOrError,
        evidenceGate,
      };
    },
    runCp4ReleaseEvidenceCaptureJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runCp4ReleaseEvidenceCapture(params) ?? null,
        null,
        2,
      )
    ),
    runCp4ReleaseEvidenceGateProbe: (params) => (
      root.obscurM6VoiceReplay?.runCp4ReleaseEvidenceCapture(params)?.evidenceGate ?? {
        pass: false,
        failedChecks: ["cp4_release_evidence_capture_unavailable"],
        checks: EMPTY_CP4_RELEASE_EVIDENCE_GATE_CHECKS,
      }
    ),
    runCp4ReleaseEvidenceGateProbeJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runCp4ReleaseEvidenceGateProbe(params) ?? null,
        null,
        2,
      )
    ),
    runV120CloseoutCapture: (params) => {
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      const baseUnixMs = typeof params?.baseUnixMs === "number" && Number.isFinite(params.baseUnixMs)
        ? Math.floor(params.baseUnixMs)
        : Date.now();
      const expectedPass = typeof params?.expectedPass === "boolean"
        ? params.expectedPass
        : params?.injectRecoveryExhausted !== true;
      const cp3Suite = root.obscurM6VoiceReplay?.runCp3ReplaySuiteCapture({
        clearAppEvents: params?.clearAppEvents,
        captureWindowSize,
        mode: params?.mode,
        baseUnixMs,
      }) ?? {
        generatedAtUnixMs: Date.now(),
        weakNetwork: {
          replay: null,
          capture: null,
          cp2EvidenceGate: buildCp2EvidenceGate(null, null),
        },
        accountSwitch: {
          replay: null,
          capture: null,
          cp2EvidenceGate: buildCp2EvidenceGate(null, null),
        },
        suiteGate: {
          pass: false,
          failedChecks: ["suite_capture_unavailable"],
          checks: EMPTY_REPLAY_SUITE_GATE_CHECKS,
        },
      };
      const cp4ReleaseEvidence = root.obscurM6VoiceReplay?.runCp4ReleaseEvidenceCapture({
        ...params,
        clearAppEvents: true,
        captureWindowSize,
        baseUnixMs: baseUnixMs + 60_000,
      }) ?? {
        generatedAtUnixMs: Date.now(),
        releaseReadiness: {
          generatedAtUnixMs: Date.now(),
          checkpoint: {
            generatedAtUnixMs: Date.now(),
            longSession: {
              replay: null,
              capture: null,
              replayConfig: {
                cycleCount: toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT),
                injectRecoveryExhausted: params?.injectRecoveryExhausted === true,
              },
              cp4ReadinessGate: buildCp4ReadinessGate({
                replay: null,
                capture: null,
                cycleCount: toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT),
              }),
            },
            gateProbe: buildCp4LongSessionGateProbe({
              capture: null,
              expectedPass,
              latestGateEventContext: null,
            }),
            selfTest: {
              generatedAtUnixMs: Date.now(),
              nominal: {
                replay: null,
                capture: null,
                replayConfig: {
                  cycleCount: toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT),
                  injectRecoveryExhausted: false,
                },
                cp4ReadinessGate: buildCp4ReadinessGate({
                  replay: null,
                  capture: null,
                  cycleCount: toPositiveInteger(params?.cycleCount, DEFAULT_LONG_SESSION_CYCLE_COUNT),
                }),
              },
              failureInjection: {
                replay: null,
                capture: null,
                replayConfig: {
                  cycleCount: toPositiveInteger(params?.selfTestFailureCycleCount, 3),
                  injectRecoveryExhausted: true,
                },
                cp4ReadinessGate: buildCp4ReadinessGate({
                  replay: null,
                  capture: null,
                  cycleCount: toPositiveInteger(params?.selfTestFailureCycleCount, 3),
                }),
              },
              selfTestGate: buildBooleanGate({
                nominalPass: false,
                nominalFinalPhaseActive: false,
                nominalRecoveryExhaustedZero: false,
                failureGateRejected: false,
                failureFinalPhaseEnded: false,
                failureReasonRecoveryExhausted: false,
                failureGateFlagsRecoverySignals: false,
              }),
            },
            digestSummary: null,
            cp4CheckpointGate: {
              pass: false,
              failedChecks: ["cp4_checkpoint_capture_unavailable"],
              checks: EMPTY_CP4_CHECKPOINT_GATE_CHECKS,
            },
          },
          latestLongSessionGateEventContext: null,
          latestCheckpointGateEventContext: null,
          digestSummary: null,
          releaseReadinessGate: {
            pass: false,
            failedChecks: ["cp4_release_readiness_capture_unavailable"],
            checks: EMPTY_CP4_RELEASE_READINESS_GATE_CHECKS,
          },
        },
        longSessionGateEventContexts: [],
        checkpointGateEventContexts: [],
        releaseReadinessGateEventContexts: [],
        recentWarnOrError: [],
        evidenceGate: {
          pass: false,
          failedChecks: ["cp4_release_evidence_capture_unavailable"],
          checks: EMPTY_CP4_RELEASE_EVIDENCE_GATE_CHECKS,
        },
      };
      const closeoutGate = buildV120CloseoutGate({
        cp3Suite,
        cp4ReleaseEvidence,
        expectedPass,
      });
      emitV120CloseoutGateDiagnostic({
        closeoutGate,
        cp3Suite,
        cp4ReleaseEvidence,
        expectedPass,
      });
      return {
        generatedAtUnixMs: Date.now(),
        cp3Suite,
        cp4ReleaseEvidence,
        closeoutGate,
      };
    },
    runV120CloseoutCaptureJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runV120CloseoutCapture(params) ?? null,
        null,
        2,
      )
    ),
    runV120CloseoutGateProbe: (params) => (
      root.obscurM6VoiceReplay?.runV120CloseoutCapture(params)?.closeoutGate ?? {
        pass: false,
        failedChecks: ["v120_closeout_capture_unavailable"],
        checks: EMPTY_V120_CLOSEOUT_GATE_CHECKS,
      }
    ),
    runV120CloseoutGateProbeJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runV120CloseoutGateProbe(params) ?? null,
        null,
        2,
      )
    ),
    runCp3ReplaySuiteCapture: (params) => {
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      const baseUnixMs = typeof params?.baseUnixMs === "number" && Number.isFinite(params.baseUnixMs)
        ? Math.floor(params.baseUnixMs)
        : Date.now();
      const weakNetwork = root.obscurM6VoiceReplay?.runWeakNetworkReplayCapture({
        clearAppEvents: params?.clearAppEvents,
        captureWindowSize,
        mode: params?.mode,
        baseUnixMs,
      }) ?? {
        replay: null,
        capture: null,
        cp2EvidenceGate: buildCp2EvidenceGate(null, null),
      };
      const accountSwitch = root.obscurM6VoiceReplay?.runAccountSwitchReplayCapture({
        clearAppEvents: false,
        captureWindowSize,
        mode: params?.mode,
        baseUnixMs: baseUnixMs + 10_000,
      }) ?? {
        replay: null,
        capture: null,
        cp2EvidenceGate: buildCp2EvidenceGate(null, null),
      };
      return {
        generatedAtUnixMs: Date.now(),
        weakNetwork,
        accountSwitch,
        suiteGate: buildReplaySuiteGate({
          weakNetwork,
          accountSwitch,
        }),
      };
    },
    runCp3ReplaySuiteCaptureJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runCp3ReplaySuiteCapture(params) ?? null,
        null,
        2,
      )
    ),
    runCp3ReplaySuiteGateProbe: (params) => (
      root.obscurM6VoiceReplay?.runCp3ReplaySuiteCapture(params)?.suiteGate ?? {
        pass: false,
        failedChecks: ["suite_capture_unavailable"],
        checks: EMPTY_REPLAY_SUITE_GATE_CHECKS,
      }
    ),
    runCp3ReplaySuiteGateProbeJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runCp3ReplaySuiteGateProbe(params) ?? null,
        null,
        2,
      )
    ),
    runCp3SingleDeviceSelfTest: (params) => {
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, DEFAULT_CAPTURE_WINDOW_SIZE);
      const baseUnixMs = typeof params?.baseUnixMs === "number" && Number.isFinite(params.baseUnixMs)
        ? Math.floor(params.baseUnixMs)
        : Date.now();
      const suite = root.obscurM6VoiceReplay?.runCp3ReplaySuiteCapture({
        clearAppEvents: params?.clearAppEvents,
        captureWindowSize,
        mode: params?.mode,
        baseUnixMs,
      }) ?? {
        generatedAtUnixMs: Date.now(),
        weakNetwork: {
          replay: null,
          capture: null,
          cp2EvidenceGate: buildCp2EvidenceGate(null, null),
        },
        accountSwitch: {
          replay: null,
          capture: null,
          cp2EvidenceGate: buildCp2EvidenceGate(null, null),
        },
        suiteGate: {
          pass: false,
          failedChecks: ["suite_capture_unavailable"],
          checks: EMPTY_REPLAY_SUITE_GATE_CHECKS,
        },
      };

      root.obscurAppEvents?.clear?.();
      clockUnixMs = baseUnixMs + 20_000;
      state = owner.reset({
        maxRecoveryAttempts: 3,
      });
      root.obscurM6VoiceReplay?.start({
        roomId: "m6-cp3-unsupported-room",
        mode: params?.mode ?? "join",
        supported: false,
        unsupportedReasonCode: "webrtc_unavailable",
      });
      const unsupportedTransitions = readEventsByName(
        root,
        "messaging.realtime_voice.session_transition",
        captureWindowSize,
      );
      const unsupportedDigestSummary = readDigestSummary(root, captureWindowSize);
      const unsupportedProbe = buildUnsupportedProbeGate({
        finalState: state,
        transitionEvents: unsupportedTransitions,
        latestDigestSummary: unsupportedDigestSummary,
      });

      root.obscurAppEvents?.clear?.();
      clockUnixMs = baseUnixMs + 30_000;
      state = owner.reset({
        maxRecoveryAttempts: 2,
      });
      root.obscurM6VoiceReplay?.start({
        roomId: "m6-cp3-recovery-room",
        mode: params?.mode ?? "join",
        supported: true,
      });
      root.obscurM6VoiceReplay?.connect({
        participantCount: 2,
        hasPeerSessionEvidence: true,
      });
      root.obscurM6VoiceReplay?.degrade({ reasonCode: "network_degraded" });
      root.obscurM6VoiceReplay?.requestRecovery();
      root.obscurM6VoiceReplay?.failRecovery({ reasonCode: "transport_timeout" });
      root.obscurM6VoiceReplay?.requestRecovery();
      root.obscurM6VoiceReplay?.failRecovery({ reasonCode: "transport_timeout" });
      const recoveryTransitions = readEventsByName(
        root,
        "messaging.realtime_voice.session_transition",
        captureWindowSize,
      );
      const recoveryDigestSummary = readDigestSummary(root, captureWindowSize);
      const recoveryExhaustedProbe = buildRecoveryExhaustedProbeGate({
        finalState: state,
        transitionEvents: recoveryTransitions,
        latestDigestSummary: recoveryDigestSummary,
      });

      const selfTestGate = buildBooleanGate({
        suiteGatePass: suite.suiteGate.pass,
        weakNetworkCp2Pass: suite.weakNetwork.cp2EvidenceGate.pass,
        accountSwitchCp2Pass: suite.accountSwitch.cp2EvidenceGate.pass,
        unsupportedProbePass: unsupportedProbe.pass,
        recoveryExhaustedProbePass: recoveryExhaustedProbe.pass,
      });

      return {
        generatedAtUnixMs: Date.now(),
        suite,
        unsupportedProbe,
        recoveryExhaustedProbe,
        selfTestGate,
      };
    },
    runCp3SingleDeviceSelfTestJson: (params) => (
      JSON.stringify(
        root.obscurM6VoiceReplay?.runCp3SingleDeviceSelfTest(params) ?? null,
        null,
        2,
      )
    ),
  };
};

export const m6VoiceReplayBridgeInternals = {
  buildReplaySuiteGate,
  buildCp4ReadinessGate,
  buildCp4LongSessionGateProbe,
  buildCp4CheckpointGate,
  buildCp4ReleaseReadinessGate,
  buildCp4ReleaseEvidenceGate,
  buildV120CloseoutGate,
  buildCp4LongSessionSelfTestGate,
  buildReplayResult,
  buildCp2EvidenceGate,
  buildReplayReadiness,
  countDistinctRoomHints,
  countRecoveredActiveTransitions,
  parseDigestSummary,
  toRoomIdHint,
  toPositiveInteger,
};
