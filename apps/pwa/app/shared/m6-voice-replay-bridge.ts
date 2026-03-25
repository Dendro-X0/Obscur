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
  runCp4LongSessionGateProbe: (params?: M6Cp4LongSessionGateProbeParams) => M6VoiceLongSessionGateProbe;
  runCp4LongSessionGateProbeJson: (params?: M6Cp4LongSessionGateProbeParams) => string;
  runCp4LongSessionSelfTest: (params?: M6Cp4LongSessionSelfTestParams) => M6VoiceLongSessionSelfTestReport;
  runCp4LongSessionSelfTestJson: (params?: M6Cp4LongSessionSelfTestParams) => string;
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

const toStringOrNull = (value: unknown): string | null => (
  typeof value === "string" && value.trim().length > 0 ? value : null
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
    latestToPhase: toStringOrNull(value.latestToPhase),
    latestReasonCode: toStringOrNull(value.latestReasonCode),
    latestIgnoredReasonCode: toStringOrNull(value.latestIgnoredReasonCode),
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
    && typeof root.obscurM6VoiceReplay.runCp4LongSessionGateProbe === "function"
    && typeof root.obscurM6VoiceReplay.runCp4LongSessionGateProbeJson === "function"
    && typeof root.obscurM6VoiceReplay.runCp4LongSessionSelfTest === "function"
    && typeof root.obscurM6VoiceReplay.runLongSessionReplayCapture === "function"
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
