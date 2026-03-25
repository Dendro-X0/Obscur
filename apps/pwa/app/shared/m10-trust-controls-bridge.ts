import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  clearSignedSharedIntelSignals,
  getAttackModeSafetyProfile,
  getSignedSharedIntelSignals,
  ingestSignedSharedIntelSignals,
  setAttackModeSafetyProfile,
  setSignedSharedIntelSignals,
  type SignedSharedIntelIngestResult,
  type AttackModeSafetyProfile,
  type SignedSharedIntelSignal,
} from "@/app/features/messaging/services/m10-shared-intel-policy";
import { logAppEvent } from "@/app/shared/log-app-event";

type MinimalAppEvent = Readonly<{
  name: string;
  level?: string;
  atUnixMs?: number;
  context?: Readonly<Record<string, string | number | boolean | null>>;
}>;

type M10TrustControlsSnapshot = Readonly<{
  generatedAtUnixMs: number;
  attackModeSafetyProfile: AttackModeSafetyProfile;
  signalCount: number;
  activeSignalCount: number;
  expiredSignalCount: number;
  relayHostSignalCount: number;
  peerSignalCount: number;
  blockDispositionCount: number;
  watchDispositionCount: number;
}>;

type M10TrustControlsCapture = Readonly<{
  snapshot: M10TrustControlsSnapshot;
  recentAttackModeQuarantineEvents: ReadonlyArray<MinimalAppEvent>;
  recentTrustControlEvents: ReadonlyArray<MinimalAppEvent>;
  recentResponsivenessEvents: ReadonlyArray<MinimalAppEvent>;
}>;

type M10IncomingRequestAntiAbuseSummary = Readonly<{
  riskLevel: "none" | "watch" | "high";
  quarantinedCount: number;
  latestReasonCode: string | null;
}> | null;

type M10TrustControlsDigestSummary = Readonly<{
  riskLevel: "none" | "watch" | "high";
  cp2StabilityGateCount: number;
  cp2StabilityGatePassCount: number;
  cp2StabilityGateFailCount: number;
  cp2StabilityGateUnexpectedFailCount: number;
  cp3ReadinessGateCount: number;
  cp3ReadinessGatePassCount: number;
  cp3ReadinessGateFailCount: number;
  cp3ReadinessGateUnexpectedFailCount: number;
  cp3SuiteGateCount: number;
  cp3SuiteGatePassCount: number;
  cp3SuiteGateFailCount: number;
  cp3SuiteGateUnexpectedFailCount: number;
  cp4CloseoutGateCount: number;
  cp4CloseoutGatePassCount: number;
  cp4CloseoutGateFailCount: number;
  cp4CloseoutGateUnexpectedFailCount: number;
  v130CloseoutGateCount: number;
  v130CloseoutGatePassCount: number;
  v130CloseoutGateFailCount: number;
  v130CloseoutGateUnexpectedFailCount: number;
  v130EvidenceGateCount: number;
  v130EvidenceGatePassCount: number;
  v130EvidenceGateFailCount: number;
  v130EvidenceGateUnexpectedFailCount: number;
  latestExpectedStable: boolean | null;
  latestPass: boolean | null;
  latestFailedCheckSample: string | null;
  latestCp3ExpectedStable: boolean | null;
  latestCp3Pass: boolean | null;
  latestCp3FailedCheckSample: string | null;
  latestCp3SuiteExpectedStable: boolean | null;
  latestCp3SuitePass: boolean | null;
  latestCp3SuiteFailedCheckSample: string | null;
  latestCp4CloseoutExpectedStable: boolean | null;
  latestCp4CloseoutPass: boolean | null;
  latestCp4CloseoutFailedCheckSample: string | null;
  latestV130CloseoutExpectedStable: boolean | null;
  latestV130CloseoutPass: boolean | null;
  latestV130CloseoutFailedCheckSample: string | null;
  latestV130EvidenceExpectedStable: boolean | null;
  latestV130EvidencePass: boolean | null;
  latestV130EvidenceFailedCheckSample: string | null;
}> | null;

type M10UiResponsivenessSummary = Readonly<{
  riskLevel: "none" | "watch" | "high";
  routeStallHardFallbackCount: number;
  routeMountProbeSlowCount: number;
  routeMountPerformanceGuardEnabledCount: number;
  pageTransitionWatchdogTimeoutCount: number;
  pageTransitionEffectsDisabledCount: number;
  startupProfileBootStallTimeoutCount: number;
  latestRouteSurface: string | null;
}> | null;

type M10Cp2TriageDigestSummary = Readonly<{
  incomingRequestAntiAbuse: M10IncomingRequestAntiAbuseSummary;
  m10TrustControls: M10TrustControlsDigestSummary;
  uiResponsiveness: M10UiResponsivenessSummary;
}>;

type M10Cp2TriageGate = Readonly<{
  pass: boolean;
  failedChecks: ReadonlyArray<string>;
  failedCheckSample: string | null;
  checks: Readonly<{
    expectedStable: boolean;
    hasSnapshot: boolean;
    hasDigestSummary: boolean;
    incomingRequestRiskNotHigh: boolean;
    uiResponsivenessRiskNotHigh: boolean;
    routeStallHardFallbackCountZero: boolean;
    transitionEffectsDisabledCountZero: boolean;
    routeMountPerformanceGuardEnabledCountZero: boolean;
    startupProfileBootStallTimeoutCountZero: boolean;
  }>;
}>;

type M10Cp2TriageCapture = Readonly<{
  generatedAtUnixMs: number;
  eventWindowSize: number;
  expectedStable: boolean;
  capture: M10TrustControlsCapture;
  digestSummary: M10Cp2TriageDigestSummary;
  cp2TriageGate: M10Cp2TriageGate;
}>;

type M10Cp2StabilityGateProbe = M10Cp2TriageCapture;

type M10Cp3ReadinessGate = Readonly<{
  pass: boolean;
  failedChecks: ReadonlyArray<string>;
  failedCheckSample: string | null;
  checks: Readonly<{
    expectedStable: boolean;
    hasSnapshot: boolean;
    hasDigestSummary: boolean;
    cp2TriagePass: boolean;
    incomingRequestRiskNotHigh: boolean;
    uiResponsivenessRiskNotHigh: boolean;
    m10TrustControlsRiskNotHigh: boolean;
    cp2UnexpectedFailCountZero: boolean;
  }>;
}>;

type M10Cp3ReadinessCapture = Readonly<{
  generatedAtUnixMs: number;
  eventWindowSize: number;
  expectedStable: boolean;
  cp2TriageCapture: M10Cp2TriageCapture;
  cp3ReadinessGate: M10Cp3ReadinessGate;
}>;

type M10Cp3SuiteGate = Readonly<{
  pass: boolean;
  failedChecks: ReadonlyArray<string>;
  failedCheckSample: string | null;
  checks: Readonly<{
    expectedStable: boolean;
    cp3ReadinessPass: boolean;
    digestSummaryPresent: boolean;
    incomingRequestRiskNotHigh: boolean;
    uiResponsivenessRiskNotHigh: boolean;
    m10TrustControlsRiskNotHigh: boolean;
    cp3ReadinessGateObserved: boolean;
    cp3ReadinessUnexpectedFailCountZero: boolean;
  }>;
}>;

type M10Cp3SuiteCapture = Readonly<{
  generatedAtUnixMs: number;
  eventWindowSize: number;
  expectedStable: boolean;
  cp3ReadinessCapture: M10Cp3ReadinessCapture;
  digestSummaryAfterReadinessEvent: M10Cp2TriageDigestSummary;
  cp3SuiteGate: M10Cp3SuiteGate;
}>;

type M10Cp4CloseoutGate = Readonly<{
  pass: boolean;
  failedChecks: ReadonlyArray<string>;
  failedCheckSample: string | null;
  checks: Readonly<{
    expectedStable: boolean;
    cp3SuitePass: boolean;
    digestSummaryPresent: boolean;
    incomingRequestRiskNotHigh: boolean;
    uiResponsivenessRiskNotHigh: boolean;
    m10TrustControlsRiskNotHigh: boolean;
    cp3SuiteGateObserved: boolean;
    cp3SuiteUnexpectedFailCountZero: boolean;
  }>;
}>;

type M10Cp4CloseoutCapture = Readonly<{
  generatedAtUnixMs: number;
  eventWindowSize: number;
  expectedStable: boolean;
  cp3SuiteCapture: M10Cp3SuiteCapture;
  digestSummaryAfterSuiteEvent: M10Cp2TriageDigestSummary;
  cp4CloseoutGate: M10Cp4CloseoutGate;
}>;

type M10V130CloseoutGate = Readonly<{
  pass: boolean;
  failedChecks: ReadonlyArray<string>;
  failedCheckSample: string | null;
  checks: Readonly<{
    expectedStable: boolean;
    cp4CloseoutPass: boolean;
    digestSummaryPresent: boolean;
    incomingRequestRiskNotHigh: boolean;
    uiResponsivenessRiskNotHigh: boolean;
    m10TrustControlsRiskNotHigh: boolean;
    cp4CloseoutGateObserved: boolean;
    cp4CloseoutUnexpectedFailCountZero: boolean;
  }>;
}>;

type M10V130CloseoutCapture = Readonly<{
  generatedAtUnixMs: number;
  eventWindowSize: number;
  expectedStable: boolean;
  cp4CloseoutCapture: M10Cp4CloseoutCapture;
  digestSummaryAfterCloseoutEvent: M10Cp2TriageDigestSummary;
  v130CloseoutGate: M10V130CloseoutGate;
}>;

type M10V130EvidenceGate = Readonly<{
  pass: boolean;
  failedChecks: ReadonlyArray<string>;
  failedCheckSample: string | null;
  checks: Readonly<{
    expectedStable: boolean;
    v130CloseoutPass: boolean;
    digestSummaryPresent: boolean;
    incomingRequestRiskNotHigh: boolean;
    uiResponsivenessRiskNotHigh: boolean;
    m10TrustControlsRiskNotHigh: boolean;
    cp4CloseoutGateObserved: boolean;
    v130CloseoutGateObserved: boolean;
    latestV130EventMatchesGate: boolean;
    v130CloseoutUnexpectedFailCountZero: boolean;
  }>;
}>;

type M10V130EvidenceCapture = Readonly<{
  generatedAtUnixMs: number;
  eventWindowSize: number;
  expectedStable: boolean;
  v130CloseoutCapture: M10V130CloseoutCapture;
  digestSummaryAfterV130Event: M10Cp2TriageDigestSummary;
  cp4CloseoutEventContexts: ReadonlyArray<MinimalAppEvent>;
  v130CloseoutEventContexts: ReadonlyArray<MinimalAppEvent>;
  v130EvidenceGate: M10V130EvidenceGate;
}>;

type M10TrustControlsBridgeApi = Readonly<{
  getSnapshot: () => M10TrustControlsSnapshot;
  setAttackModeSafetyProfile: (profile: AttackModeSafetyProfile) => AttackModeSafetyProfile;
  replaceSignedSharedIntelSignals: (signals: ReadonlyArray<SignedSharedIntelSignal>) => number;
  ingestSignedSharedIntelSignals: (params: Readonly<{
    signals: ReadonlyArray<unknown>;
    replaceExisting?: boolean;
    requireSignatureVerification?: boolean;
  }>) => SignedSharedIntelIngestResult;
  ingestSignedSharedIntelSignalsJson: (params: Readonly<{
    payloadJson: string;
    replaceExisting?: boolean;
    requireSignatureVerification?: boolean;
  }>) => SignedSharedIntelIngestResult;
  exportSignedSharedIntelSignalsJson: () => string;
  clearSignedSharedIntelSignals: () => void;
  capture: (eventWindowSize?: number) => M10TrustControlsCapture;
  captureJson: (eventWindowSize?: number) => string;
  runCp2TriageCapture: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => M10Cp2TriageCapture;
  runCp2TriageCaptureJson: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => string;
  runCp2StabilityGateProbe: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => M10Cp2StabilityGateProbe;
  runCp2StabilityGateProbeJson: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => string;
  runCp3ReadinessCapture: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => M10Cp3ReadinessCapture;
  runCp3ReadinessCaptureJson: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => string;
  runCp3ReadinessGateProbe: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => M10Cp3ReadinessGate;
  runCp3ReadinessGateProbeJson: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => string;
  runCp3SuiteCapture: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => M10Cp3SuiteCapture;
  runCp3SuiteCaptureJson: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => string;
  runCp3SuiteGateProbe: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => M10Cp3SuiteGate;
  runCp3SuiteGateProbeJson: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => string;
  runCp4CloseoutCapture: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => M10Cp4CloseoutCapture;
  runCp4CloseoutCaptureJson: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => string;
  runCp4CloseoutGateProbe: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => M10Cp4CloseoutGate;
  runCp4CloseoutGateProbeJson: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => string;
  runV130CloseoutCapture: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => M10V130CloseoutCapture;
  runV130CloseoutCaptureJson: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => string;
  runV130CloseoutGateProbe: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => M10V130CloseoutGate;
  runV130CloseoutGateProbeJson: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => string;
  runV130EvidenceCapture: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => M10V130EvidenceCapture;
  runV130EvidenceCaptureJson: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => string;
  runV130EvidenceGateProbe: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => M10V130EvidenceGate;
  runV130EvidenceGateProbeJson: (params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>) => string;
}>;

type M10TrustControlsBridgeWindow = Window & {
  obscurM10TrustControls?: M10TrustControlsBridgeApi;
  obscurAppEvents?: Readonly<{
    findByName?: (name: string, count?: number) => ReadonlyArray<MinimalAppEvent>;
    getCrossDeviceSyncDigest?: (count?: number) => Readonly<{
      summary?: Readonly<{
        incomingRequestAntiAbuse?: Readonly<{
          riskLevel?: string;
          quarantinedCount?: number;
          latestReasonCode?: string | null;
        }>;
        m10TrustControls?: Readonly<{
          riskLevel?: string;
          cp2StabilityGateCount?: number;
          cp2StabilityGatePassCount?: number;
          cp2StabilityGateFailCount?: number;
          cp2StabilityGateUnexpectedFailCount?: number;
          cp3ReadinessGateCount?: number;
          cp3ReadinessGatePassCount?: number;
          cp3ReadinessGateFailCount?: number;
          cp3ReadinessGateUnexpectedFailCount?: number;
          cp3SuiteGateCount?: number;
          cp3SuiteGatePassCount?: number;
          cp3SuiteGateFailCount?: number;
          cp3SuiteGateUnexpectedFailCount?: number;
          cp4CloseoutGateCount?: number;
          cp4CloseoutGatePassCount?: number;
          cp4CloseoutGateFailCount?: number;
          cp4CloseoutGateUnexpectedFailCount?: number;
          v130CloseoutGateCount?: number;
          v130CloseoutGatePassCount?: number;
          v130CloseoutGateFailCount?: number;
          v130CloseoutGateUnexpectedFailCount?: number;
          v130EvidenceGateCount?: number;
          v130EvidenceGatePassCount?: number;
          v130EvidenceGateFailCount?: number;
          v130EvidenceGateUnexpectedFailCount?: number;
          latestExpectedStable?: boolean | null;
          latestPass?: boolean | null;
          latestFailedCheckSample?: string | null;
          latestCp3ExpectedStable?: boolean | null;
          latestCp3Pass?: boolean | null;
          latestCp3FailedCheckSample?: string | null;
          latestCp3SuiteExpectedStable?: boolean | null;
          latestCp3SuitePass?: boolean | null;
          latestCp3SuiteFailedCheckSample?: string | null;
          latestCp4CloseoutExpectedStable?: boolean | null;
          latestCp4CloseoutPass?: boolean | null;
          latestCp4CloseoutFailedCheckSample?: string | null;
          latestV130CloseoutExpectedStable?: boolean | null;
          latestV130CloseoutPass?: boolean | null;
          latestV130CloseoutFailedCheckSample?: string | null;
          latestV130EvidenceExpectedStable?: boolean | null;
          latestV130EvidencePass?: boolean | null;
          latestV130EvidenceFailedCheckSample?: string | null;
        }>;
        uiResponsiveness?: Readonly<{
          riskLevel?: string;
          routeStallHardFallbackCount?: number;
          routeMountProbeSlowCount?: number;
          routeMountPerformanceGuardEnabledCount?: number;
          pageTransitionWatchdogTimeoutCount?: number;
          pageTransitionEffectsDisabledCount?: number;
          startupProfileBootStallTimeoutCount?: number;
          latestRouteSurface?: string | null;
        }>;
      }>;
    }>;
  }>;
};

declare global {
  interface Window {
    obscurM10TrustControls?: M10TrustControlsBridgeApi;
  }
}

const ATTACK_MODE_REASON_PREFIX = "incoming_connection_request_attack_mode_";
const TRUST_CONTROL_EVENT_NAMES: ReadonlyArray<string> = [
  "messaging.m10.trust_controls_profile_changed",
  "messaging.m10.trust_controls_import_result",
  "messaging.m10.trust_controls_clear_applied",
  "messaging.m10.trust_controls_undo_applied",
  "messaging.m10.cp2_stability_gate",
  "messaging.m10.cp3_readiness_gate",
  "messaging.m10.cp3_suite_gate",
  "messaging.m10.cp4_closeout_gate",
  "messaging.m10.v130_closeout_gate",
  "messaging.m10.v130_evidence_gate",
];
const RESPONSIVENESS_EVENT_NAMES: ReadonlyArray<string> = [
  "navigation.route_stall_hard_fallback",
  "navigation.route_mount_probe_slow",
  "navigation.route_mount_performance_guard_enabled",
  "navigation.page_transition_watchdog_timeout",
  "navigation.page_transition_effects_disabled",
  "runtime.profile_boot_stall_timeout",
];
const CP2_STABILITY_GATE_EVENT_NAME = "messaging.m10.cp2_stability_gate";
const CP3_READINESS_GATE_EVENT_NAME = "messaging.m10.cp3_readiness_gate";
const CP3_SUITE_GATE_EVENT_NAME = "messaging.m10.cp3_suite_gate";
const CP4_CLOSEOUT_GATE_EVENT_NAME = "messaging.m10.cp4_closeout_gate";
const V130_CLOSEOUT_GATE_EVENT_NAME = "messaging.m10.v130_closeout_gate";
const V130_EVIDENCE_GATE_EVENT_NAME = "messaging.m10.v130_evidence_gate";

const isPositiveFinite = (value: unknown): value is number => (
  typeof value === "number" && Number.isFinite(value) && value > 0
);

const toWindowSize = (value: unknown, fallback = 300): number => {
  if (isPositiveFinite(value)) {
    return Math.max(1, Math.floor(value));
  }
  return fallback;
};

const toJsonErrorIngestResult = (): SignedSharedIntelIngestResult => ({
  acceptedCount: 0,
  rejectedCount: 1,
  storedSignalCount: getSignedSharedIntelSignals().length,
  rejectedByReason: {
    invalid_shape: 1,
    expired: 0,
    missing_signature_verifier: 0,
    invalid_signature: 0,
  },
  rejectedSignalIdSamples: ["invalid_json"],
});

const toRiskLevel = (value: unknown): "none" | "watch" | "high" => (
  value === "high" || value === "watch" ? value : "none"
);

const toNumber = (value: unknown): number => (
  typeof value === "number" && Number.isFinite(value) ? value : 0
);

const toStringOrNull = (value: unknown): string | null => (
  typeof value === "string" && value.trim().length > 0 ? value : null
);

const toBooleanOrNull = (value: unknown): boolean | null => (
  typeof value === "boolean" ? value : null
);

const createSnapshot = (): M10TrustControlsSnapshot => {
  const nowUnixMs = Date.now();
  const profile = getAttackModeSafetyProfile();
  const signals = getSignedSharedIntelSignals();

  const activeSignalCount = signals.filter((signal) => signal.expiresAtUnixMs > nowUnixMs).length;
  const expiredSignalCount = signals.length - activeSignalCount;
  const relayHostSignalCount = signals.filter((signal) => signal.subjectType === "relay_host").length;
  const peerSignalCount = signals.length - relayHostSignalCount;
  const blockDispositionCount = signals.filter((signal) => signal.disposition === "block").length;
  const watchDispositionCount = signals.length - blockDispositionCount;

  return {
    generatedAtUnixMs: nowUnixMs,
    attackModeSafetyProfile: profile,
    signalCount: signals.length,
    activeSignalCount,
    expiredSignalCount,
    relayHostSignalCount,
    peerSignalCount,
    blockDispositionCount,
    watchDispositionCount,
  };
};

const readAttackModeQuarantineEvents = (
  root: M10TrustControlsBridgeWindow,
  eventWindowSize: number,
): ReadonlyArray<MinimalAppEvent> => {
  try {
    if (typeof root.obscurAppEvents?.findByName !== "function") {
      return [];
    }
    const events = root.obscurAppEvents.findByName("messaging.request.incoming_quarantined", eventWindowSize);
    return events.filter((event) => (
      typeof event.context?.reasonCode === "string"
      && event.context.reasonCode.startsWith(ATTACK_MODE_REASON_PREFIX)
    ));
  } catch {
    return [];
  }
};

const readTrustControlEvents = (
  root: M10TrustControlsBridgeWindow,
  eventWindowSize: number,
): ReadonlyArray<MinimalAppEvent> => {
  try {
    if (typeof root.obscurAppEvents?.findByName !== "function") {
      return [];
    }
    const mergedEvents = TRUST_CONTROL_EVENT_NAMES.flatMap((name) => (
      root.obscurAppEvents?.findByName?.(name, eventWindowSize) ?? []
    ));
    return mergedEvents
      .slice()
      .sort((left, right) => (left.atUnixMs ?? 0) - (right.atUnixMs ?? 0))
      .slice(-eventWindowSize);
  } catch {
    return [];
  }
};

const readResponsivenessEvents = (
  root: M10TrustControlsBridgeWindow,
  eventWindowSize: number,
): ReadonlyArray<MinimalAppEvent> => {
  try {
    if (typeof root.obscurAppEvents?.findByName !== "function") {
      return [];
    }
    const mergedEvents = RESPONSIVENESS_EVENT_NAMES.flatMap((name) => (
      root.obscurAppEvents?.findByName?.(name, eventWindowSize) ?? []
    ));
    return mergedEvents
      .slice()
      .sort((left, right) => (left.atUnixMs ?? 0) - (right.atUnixMs ?? 0))
      .slice(-eventWindowSize);
  } catch {
    return [];
  }
};

const readEventsByName = (
  root: M10TrustControlsBridgeWindow,
  eventName: string,
  eventWindowSize: number,
): ReadonlyArray<MinimalAppEvent> => {
  try {
    if (typeof root.obscurAppEvents?.findByName !== "function") {
      return [];
    }
    const events = root.obscurAppEvents.findByName(eventName, eventWindowSize);
    return events
      .slice()
      .sort((left, right) => (left.atUnixMs ?? 0) - (right.atUnixMs ?? 0))
      .slice(-eventWindowSize);
  } catch {
    return [];
  }
};

const createCapture = (
  root: M10TrustControlsBridgeWindow,
  eventWindowSize: number,
): M10TrustControlsCapture => ({
  snapshot: createSnapshot(),
  recentAttackModeQuarantineEvents: readAttackModeQuarantineEvents(root, eventWindowSize),
  recentTrustControlEvents: readTrustControlEvents(root, eventWindowSize),
  recentResponsivenessEvents: readResponsivenessEvents(root, eventWindowSize),
});

const readCp2TriageDigestSummary = (
  root: M10TrustControlsBridgeWindow,
  eventWindowSize: number,
): M10Cp2TriageDigestSummary => {
  const summary = root.obscurAppEvents?.getCrossDeviceSyncDigest?.(eventWindowSize)?.summary;
  const incoming = summary?.incomingRequestAntiAbuse;
  const trustControls = summary?.m10TrustControls;
  const responsiveness = summary?.uiResponsiveness;
  return {
    incomingRequestAntiAbuse: incoming ? {
      riskLevel: toRiskLevel(incoming.riskLevel),
      quarantinedCount: toNumber(incoming.quarantinedCount),
      latestReasonCode: toStringOrNull(incoming.latestReasonCode),
    } : null,
    m10TrustControls: trustControls ? {
      riskLevel: toRiskLevel(trustControls.riskLevel),
      cp2StabilityGateCount: toNumber(trustControls.cp2StabilityGateCount),
      cp2StabilityGatePassCount: toNumber(trustControls.cp2StabilityGatePassCount),
      cp2StabilityGateFailCount: toNumber(trustControls.cp2StabilityGateFailCount),
      cp2StabilityGateUnexpectedFailCount: toNumber(trustControls.cp2StabilityGateUnexpectedFailCount),
      cp3ReadinessGateCount: toNumber(trustControls.cp3ReadinessGateCount),
      cp3ReadinessGatePassCount: toNumber(trustControls.cp3ReadinessGatePassCount),
      cp3ReadinessGateFailCount: toNumber(trustControls.cp3ReadinessGateFailCount),
      cp3ReadinessGateUnexpectedFailCount: toNumber(trustControls.cp3ReadinessGateUnexpectedFailCount),
      cp3SuiteGateCount: toNumber(trustControls.cp3SuiteGateCount),
      cp3SuiteGatePassCount: toNumber(trustControls.cp3SuiteGatePassCount),
      cp3SuiteGateFailCount: toNumber(trustControls.cp3SuiteGateFailCount),
      cp3SuiteGateUnexpectedFailCount: toNumber(trustControls.cp3SuiteGateUnexpectedFailCount),
      cp4CloseoutGateCount: toNumber(trustControls.cp4CloseoutGateCount),
      cp4CloseoutGatePassCount: toNumber(trustControls.cp4CloseoutGatePassCount),
      cp4CloseoutGateFailCount: toNumber(trustControls.cp4CloseoutGateFailCount),
      cp4CloseoutGateUnexpectedFailCount: toNumber(trustControls.cp4CloseoutGateUnexpectedFailCount),
      v130CloseoutGateCount: toNumber(trustControls.v130CloseoutGateCount),
      v130CloseoutGatePassCount: toNumber(trustControls.v130CloseoutGatePassCount),
      v130CloseoutGateFailCount: toNumber(trustControls.v130CloseoutGateFailCount),
      v130CloseoutGateUnexpectedFailCount: toNumber(trustControls.v130CloseoutGateUnexpectedFailCount),
      v130EvidenceGateCount: toNumber(trustControls.v130EvidenceGateCount),
      v130EvidenceGatePassCount: toNumber(trustControls.v130EvidenceGatePassCount),
      v130EvidenceGateFailCount: toNumber(trustControls.v130EvidenceGateFailCount),
      v130EvidenceGateUnexpectedFailCount: toNumber(trustControls.v130EvidenceGateUnexpectedFailCount),
      latestExpectedStable: toBooleanOrNull(trustControls.latestExpectedStable),
      latestPass: toBooleanOrNull(trustControls.latestPass),
      latestFailedCheckSample: toStringOrNull(trustControls.latestFailedCheckSample),
      latestCp3ExpectedStable: toBooleanOrNull(trustControls.latestCp3ExpectedStable),
      latestCp3Pass: toBooleanOrNull(trustControls.latestCp3Pass),
      latestCp3FailedCheckSample: toStringOrNull(trustControls.latestCp3FailedCheckSample),
      latestCp3SuiteExpectedStable: toBooleanOrNull(trustControls.latestCp3SuiteExpectedStable),
      latestCp3SuitePass: toBooleanOrNull(trustControls.latestCp3SuitePass),
      latestCp3SuiteFailedCheckSample: toStringOrNull(trustControls.latestCp3SuiteFailedCheckSample),
      latestCp4CloseoutExpectedStable: toBooleanOrNull(trustControls.latestCp4CloseoutExpectedStable),
      latestCp4CloseoutPass: toBooleanOrNull(trustControls.latestCp4CloseoutPass),
      latestCp4CloseoutFailedCheckSample: toStringOrNull(trustControls.latestCp4CloseoutFailedCheckSample),
      latestV130CloseoutExpectedStable: toBooleanOrNull(trustControls.latestV130CloseoutExpectedStable),
      latestV130CloseoutPass: toBooleanOrNull(trustControls.latestV130CloseoutPass),
      latestV130CloseoutFailedCheckSample: toStringOrNull(trustControls.latestV130CloseoutFailedCheckSample),
      latestV130EvidenceExpectedStable: toBooleanOrNull(trustControls.latestV130EvidenceExpectedStable),
      latestV130EvidencePass: toBooleanOrNull(trustControls.latestV130EvidencePass),
      latestV130EvidenceFailedCheckSample: toStringOrNull(trustControls.latestV130EvidenceFailedCheckSample),
    } : null,
    uiResponsiveness: responsiveness ? {
      riskLevel: toRiskLevel(responsiveness.riskLevel),
      routeStallHardFallbackCount: toNumber(responsiveness.routeStallHardFallbackCount),
      routeMountProbeSlowCount: toNumber(responsiveness.routeMountProbeSlowCount),
      routeMountPerformanceGuardEnabledCount: toNumber(responsiveness.routeMountPerformanceGuardEnabledCount),
      pageTransitionWatchdogTimeoutCount: toNumber(responsiveness.pageTransitionWatchdogTimeoutCount),
      pageTransitionEffectsDisabledCount: toNumber(responsiveness.pageTransitionEffectsDisabledCount),
      startupProfileBootStallTimeoutCount: toNumber(responsiveness.startupProfileBootStallTimeoutCount),
      latestRouteSurface: toStringOrNull(responsiveness.latestRouteSurface),
    } : null,
  };
};

const buildCp2TriageGate = (params: Readonly<{
  expectedStable: boolean;
  capture: M10TrustControlsCapture;
  digestSummary: M10Cp2TriageDigestSummary;
}>): M10Cp2TriageGate => {
  const checks = {
    expectedStable: params.expectedStable,
    hasSnapshot: params.capture.snapshot.signalCount >= 0,
    hasDigestSummary: (
      !params.expectedStable
      || params.digestSummary.incomingRequestAntiAbuse !== null
      || params.digestSummary.uiResponsiveness !== null
    ),
    incomingRequestRiskNotHigh: (
      !params.expectedStable
      || params.digestSummary.incomingRequestAntiAbuse?.riskLevel !== "high"
    ),
    uiResponsivenessRiskNotHigh: (
      !params.expectedStable
      || params.digestSummary.uiResponsiveness?.riskLevel !== "high"
    ),
    routeStallHardFallbackCountZero: (
      !params.expectedStable
      || (params.digestSummary.uiResponsiveness?.routeStallHardFallbackCount ?? 0) === 0
    ),
    transitionEffectsDisabledCountZero: (
      !params.expectedStable
      || (params.digestSummary.uiResponsiveness?.pageTransitionEffectsDisabledCount ?? 0) === 0
    ),
    routeMountPerformanceGuardEnabledCountZero: (
      !params.expectedStable
      || (params.digestSummary.uiResponsiveness?.routeMountPerformanceGuardEnabledCount ?? 0) === 0
    ),
    startupProfileBootStallTimeoutCountZero: (
      !params.expectedStable
      || (params.digestSummary.uiResponsiveness?.startupProfileBootStallTimeoutCount ?? 0) === 0
    ),
  } as const;

  const failedChecks = Object.entries(checks)
    .filter(([name, passed]) => name !== "expectedStable" && passed !== true)
    .map(([name]) => name);

  return {
    pass: failedChecks.length === 0,
    failedChecks,
    failedCheckSample: failedChecks[0] ?? null,
    checks,
  };
};

const createCp2TriageCapture = (
  root: M10TrustControlsBridgeWindow,
  params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>,
): M10Cp2TriageCapture => {
  const eventWindowSize = toWindowSize(params?.eventWindowSize, 400);
  const expectedStable = params?.expectedStable !== false;
  const capture = createCapture(root, eventWindowSize);
  const digestSummary = readCp2TriageDigestSummary(root, eventWindowSize);
  return {
    generatedAtUnixMs: Date.now(),
    eventWindowSize,
    expectedStable,
    capture,
    digestSummary,
    cp2TriageGate: buildCp2TriageGate({
      expectedStable,
      capture,
      digestSummary,
    }),
  };
};

const emitCp2StabilityGateEvent = (probe: M10Cp2StabilityGateProbe): void => {
  logAppEvent({
    name: CP2_STABILITY_GATE_EVENT_NAME,
    level: probe.cp2TriageGate.pass ? "info" : "warn",
    scope: { feature: "messaging", action: "m10_trust_controls" },
    context: {
      expectedStable: probe.expectedStable,
      cp2Pass: probe.cp2TriageGate.pass,
      failedCheckCount: probe.cp2TriageGate.failedChecks.length,
      failedCheckSample: probe.cp2TriageGate.failedCheckSample,
      incomingRequestRiskLevel: probe.digestSummary.incomingRequestAntiAbuse?.riskLevel ?? "none",
      incomingRequestQuarantinedCount: probe.digestSummary.incomingRequestAntiAbuse?.quarantinedCount ?? 0,
      uiResponsivenessRiskLevel: probe.digestSummary.uiResponsiveness?.riskLevel ?? "none",
      uiRouteStallHardFallbackCount: probe.digestSummary.uiResponsiveness?.routeStallHardFallbackCount ?? 0,
      uiPageTransitionEffectsDisabledCount: probe.digestSummary.uiResponsiveness?.pageTransitionEffectsDisabledCount ?? 0,
      uiRouteMountPerformanceGuardEnabledCount: (
        probe.digestSummary.uiResponsiveness?.routeMountPerformanceGuardEnabledCount ?? 0
      ),
      uiStartupProfileBootStallTimeoutCount: (
        probe.digestSummary.uiResponsiveness?.startupProfileBootStallTimeoutCount ?? 0
      ),
    },
  });
};

const buildCp3ReadinessGate = (params: Readonly<{
  expectedStable: boolean;
  cp2TriageCapture: M10Cp2TriageCapture;
}>): M10Cp3ReadinessGate => {
  const digestSummary = params.cp2TriageCapture.digestSummary;
  const checks = {
    expectedStable: params.expectedStable,
    hasSnapshot: params.cp2TriageCapture.capture.snapshot.signalCount >= 0,
    hasDigestSummary: (
      !params.expectedStable
      || digestSummary.incomingRequestAntiAbuse !== null
      || digestSummary.uiResponsiveness !== null
      || digestSummary.m10TrustControls !== null
    ),
    cp2TriagePass: (
      !params.expectedStable
      || params.cp2TriageCapture.cp2TriageGate.pass
    ),
    incomingRequestRiskNotHigh: (
      !params.expectedStable
      || digestSummary.incomingRequestAntiAbuse?.riskLevel !== "high"
    ),
    uiResponsivenessRiskNotHigh: (
      !params.expectedStable
      || digestSummary.uiResponsiveness?.riskLevel !== "high"
    ),
    m10TrustControlsRiskNotHigh: (
      !params.expectedStable
      || digestSummary.m10TrustControls?.riskLevel !== "high"
    ),
    cp2UnexpectedFailCountZero: (
      !params.expectedStable
      || (digestSummary.m10TrustControls?.cp2StabilityGateUnexpectedFailCount ?? 0) === 0
    ),
  } as const;

  const failedChecks = Object.entries(checks)
    .filter(([name, passed]) => name !== "expectedStable" && passed !== true)
    .map(([name]) => name);

  return {
    pass: failedChecks.length === 0,
    failedChecks,
    failedCheckSample: failedChecks[0] ?? null,
    checks,
  };
};

const createCp3ReadinessCapture = (
  root: M10TrustControlsBridgeWindow,
  params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>,
): M10Cp3ReadinessCapture => {
  const cp2TriageCapture = createCp2TriageCapture(root, params);
  return {
    generatedAtUnixMs: Date.now(),
    eventWindowSize: cp2TriageCapture.eventWindowSize,
    expectedStable: cp2TriageCapture.expectedStable,
    cp2TriageCapture,
    cp3ReadinessGate: buildCp3ReadinessGate({
      expectedStable: cp2TriageCapture.expectedStable,
      cp2TriageCapture,
    }),
  };
};

const emitCp3ReadinessGateEvent = (capture: M10Cp3ReadinessCapture): void => {
  const digestSummary = capture.cp2TriageCapture.digestSummary;
  logAppEvent({
    name: CP3_READINESS_GATE_EVENT_NAME,
    level: capture.cp3ReadinessGate.pass ? "info" : "warn",
    scope: { feature: "messaging", action: "m10_trust_controls" },
    context: {
      expectedStable: capture.expectedStable,
      cp3Pass: capture.cp3ReadinessGate.pass,
      failedCheckCount: capture.cp3ReadinessGate.failedChecks.length,
      failedCheckSample: capture.cp3ReadinessGate.failedCheckSample,
      cp2TriagePass: capture.cp2TriageCapture.cp2TriageGate.pass,
      incomingRequestRiskLevel: digestSummary.incomingRequestAntiAbuse?.riskLevel ?? "none",
      uiResponsivenessRiskLevel: digestSummary.uiResponsiveness?.riskLevel ?? "none",
      m10TrustControlsRiskLevel: digestSummary.m10TrustControls?.riskLevel ?? "none",
      cp2StabilityGateUnexpectedFailCount: (
        digestSummary.m10TrustControls?.cp2StabilityGateUnexpectedFailCount ?? 0
      ),
    },
  });
};

const buildCp3SuiteGate = (params: Readonly<{
  expectedStable: boolean;
  cp3ReadinessCapture: M10Cp3ReadinessCapture;
  digestSummaryAfterReadinessEvent: M10Cp2TriageDigestSummary;
}>): M10Cp3SuiteGate => {
  const digestSummary = params.digestSummaryAfterReadinessEvent;
  const checks = {
    expectedStable: params.expectedStable,
    cp3ReadinessPass: (
      !params.expectedStable
      || params.cp3ReadinessCapture.cp3ReadinessGate.pass
    ),
    digestSummaryPresent: (
      !params.expectedStable
      || digestSummary.incomingRequestAntiAbuse !== null
      || digestSummary.uiResponsiveness !== null
      || digestSummary.m10TrustControls !== null
    ),
    incomingRequestRiskNotHigh: (
      !params.expectedStable
      || digestSummary.incomingRequestAntiAbuse?.riskLevel !== "high"
    ),
    uiResponsivenessRiskNotHigh: (
      !params.expectedStable
      || digestSummary.uiResponsiveness?.riskLevel !== "high"
    ),
    m10TrustControlsRiskNotHigh: (
      !params.expectedStable
      || digestSummary.m10TrustControls?.riskLevel !== "high"
    ),
    cp3ReadinessGateObserved: (
      !params.expectedStable
      || (digestSummary.m10TrustControls?.cp3ReadinessGateCount ?? 0) > 0
    ),
    cp3ReadinessUnexpectedFailCountZero: (
      !params.expectedStable
      || (digestSummary.m10TrustControls?.cp3ReadinessGateUnexpectedFailCount ?? 0) === 0
    ),
  } as const;

  const failedChecks = Object.entries(checks)
    .filter(([name, passed]) => name !== "expectedStable" && passed !== true)
    .map(([name]) => name);

  return {
    pass: failedChecks.length === 0,
    failedChecks,
    failedCheckSample: failedChecks[0] ?? null,
    checks,
  };
};

const createCp3SuiteCapture = (
  root: M10TrustControlsBridgeWindow,
  params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>,
): M10Cp3SuiteCapture => {
  const cp3ReadinessCapture = createCp3ReadinessCapture(root, params);
  emitCp3ReadinessGateEvent(cp3ReadinessCapture);
  const digestSummaryAfterReadinessEvent = readCp2TriageDigestSummary(root, cp3ReadinessCapture.eventWindowSize);
  return {
    generatedAtUnixMs: Date.now(),
    eventWindowSize: cp3ReadinessCapture.eventWindowSize,
    expectedStable: cp3ReadinessCapture.expectedStable,
    cp3ReadinessCapture,
    digestSummaryAfterReadinessEvent,
    cp3SuiteGate: buildCp3SuiteGate({
      expectedStable: cp3ReadinessCapture.expectedStable,
      cp3ReadinessCapture,
      digestSummaryAfterReadinessEvent,
    }),
  };
};

const emitCp3SuiteGateEvent = (capture: M10Cp3SuiteCapture): void => {
  const digestSummary = capture.digestSummaryAfterReadinessEvent;
  logAppEvent({
    name: CP3_SUITE_GATE_EVENT_NAME,
    level: capture.cp3SuiteGate.pass ? "info" : "warn",
    scope: { feature: "messaging", action: "m10_trust_controls" },
    context: {
      expectedStable: capture.expectedStable,
      cp3SuitePass: capture.cp3SuiteGate.pass,
      failedCheckCount: capture.cp3SuiteGate.failedChecks.length,
      failedCheckSample: capture.cp3SuiteGate.failedCheckSample,
      cp3ReadinessPass: capture.cp3ReadinessCapture.cp3ReadinessGate.pass,
      incomingRequestRiskLevel: digestSummary.incomingRequestAntiAbuse?.riskLevel ?? "none",
      uiResponsivenessRiskLevel: digestSummary.uiResponsiveness?.riskLevel ?? "none",
      m10TrustControlsRiskLevel: digestSummary.m10TrustControls?.riskLevel ?? "none",
      cp3ReadinessGateCount: digestSummary.m10TrustControls?.cp3ReadinessGateCount ?? 0,
      cp3ReadinessUnexpectedFailCount: (
        digestSummary.m10TrustControls?.cp3ReadinessGateUnexpectedFailCount ?? 0
      ),
    },
  });
};

const buildCp4CloseoutGate = (params: Readonly<{
  expectedStable: boolean;
  cp3SuiteCapture: M10Cp3SuiteCapture;
  digestSummaryAfterSuiteEvent: M10Cp2TriageDigestSummary;
}>): M10Cp4CloseoutGate => {
  const digestSummary = params.digestSummaryAfterSuiteEvent;
  const checks = {
    expectedStable: params.expectedStable,
    cp3SuitePass: (
      !params.expectedStable
      || params.cp3SuiteCapture.cp3SuiteGate.pass
    ),
    digestSummaryPresent: (
      !params.expectedStable
      || digestSummary.incomingRequestAntiAbuse !== null
      || digestSummary.uiResponsiveness !== null
      || digestSummary.m10TrustControls !== null
    ),
    incomingRequestRiskNotHigh: (
      !params.expectedStable
      || digestSummary.incomingRequestAntiAbuse?.riskLevel !== "high"
    ),
    uiResponsivenessRiskNotHigh: (
      !params.expectedStable
      || digestSummary.uiResponsiveness?.riskLevel !== "high"
    ),
    m10TrustControlsRiskNotHigh: (
      !params.expectedStable
      || digestSummary.m10TrustControls?.riskLevel !== "high"
    ),
    cp3SuiteGateObserved: (
      !params.expectedStable
      || (digestSummary.m10TrustControls?.cp3SuiteGateCount ?? 0) > 0
    ),
    cp3SuiteUnexpectedFailCountZero: (
      !params.expectedStable
      || (digestSummary.m10TrustControls?.cp3SuiteGateUnexpectedFailCount ?? 0) === 0
    ),
  } as const;

  const failedChecks = Object.entries(checks)
    .filter(([name, passed]) => name !== "expectedStable" && passed !== true)
    .map(([name]) => name);

  return {
    pass: failedChecks.length === 0,
    failedChecks,
    failedCheckSample: failedChecks[0] ?? null,
    checks,
  };
};

const createCp4CloseoutCapture = (
  root: M10TrustControlsBridgeWindow,
  params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>,
): M10Cp4CloseoutCapture => {
  const cp3SuiteCapture = createCp3SuiteCapture(root, params);
  emitCp3SuiteGateEvent(cp3SuiteCapture);
  const digestSummaryAfterSuiteEvent = readCp2TriageDigestSummary(root, cp3SuiteCapture.eventWindowSize);
  return {
    generatedAtUnixMs: Date.now(),
    eventWindowSize: cp3SuiteCapture.eventWindowSize,
    expectedStable: cp3SuiteCapture.expectedStable,
    cp3SuiteCapture,
    digestSummaryAfterSuiteEvent,
    cp4CloseoutGate: buildCp4CloseoutGate({
      expectedStable: cp3SuiteCapture.expectedStable,
      cp3SuiteCapture,
      digestSummaryAfterSuiteEvent,
    }),
  };
};

const emitCp4CloseoutGateEvent = (capture: M10Cp4CloseoutCapture): void => {
  const digestSummary = capture.digestSummaryAfterSuiteEvent;
  logAppEvent({
    name: CP4_CLOSEOUT_GATE_EVENT_NAME,
    level: capture.cp4CloseoutGate.pass ? "info" : "warn",
    scope: { feature: "messaging", action: "m10_trust_controls" },
    context: {
      expectedStable: capture.expectedStable,
      cp4CloseoutPass: capture.cp4CloseoutGate.pass,
      failedCheckCount: capture.cp4CloseoutGate.failedChecks.length,
      failedCheckSample: capture.cp4CloseoutGate.failedCheckSample,
      cp3SuitePass: capture.cp3SuiteCapture.cp3SuiteGate.pass,
      incomingRequestRiskLevel: digestSummary.incomingRequestAntiAbuse?.riskLevel ?? "none",
      uiResponsivenessRiskLevel: digestSummary.uiResponsiveness?.riskLevel ?? "none",
      m10TrustControlsRiskLevel: digestSummary.m10TrustControls?.riskLevel ?? "none",
      cp3SuiteGateCount: digestSummary.m10TrustControls?.cp3SuiteGateCount ?? 0,
      cp3SuiteUnexpectedFailCount: (
        digestSummary.m10TrustControls?.cp3SuiteGateUnexpectedFailCount ?? 0
      ),
    },
  });
};

const buildV130CloseoutGate = (params: Readonly<{
  expectedStable: boolean;
  cp4CloseoutCapture: M10Cp4CloseoutCapture;
  digestSummaryAfterCloseoutEvent: M10Cp2TriageDigestSummary;
}>): M10V130CloseoutGate => {
  const digestSummary = params.digestSummaryAfterCloseoutEvent;
  const checks = {
    expectedStable: params.expectedStable,
    cp4CloseoutPass: (
      !params.expectedStable
      || params.cp4CloseoutCapture.cp4CloseoutGate.pass
    ),
    digestSummaryPresent: (
      !params.expectedStable
      || digestSummary.incomingRequestAntiAbuse !== null
      || digestSummary.uiResponsiveness !== null
      || digestSummary.m10TrustControls !== null
    ),
    incomingRequestRiskNotHigh: (
      !params.expectedStable
      || digestSummary.incomingRequestAntiAbuse?.riskLevel !== "high"
    ),
    uiResponsivenessRiskNotHigh: (
      !params.expectedStable
      || digestSummary.uiResponsiveness?.riskLevel !== "high"
    ),
    m10TrustControlsRiskNotHigh: (
      !params.expectedStable
      || digestSummary.m10TrustControls?.riskLevel !== "high"
    ),
    cp4CloseoutGateObserved: (
      !params.expectedStable
      || (digestSummary.m10TrustControls?.cp4CloseoutGateCount ?? 0) > 0
    ),
    cp4CloseoutUnexpectedFailCountZero: (
      !params.expectedStable
      || (digestSummary.m10TrustControls?.cp4CloseoutGateUnexpectedFailCount ?? 0) === 0
    ),
  } as const;

  const failedChecks = Object.entries(checks)
    .filter(([name, passed]) => name !== "expectedStable" && passed !== true)
    .map(([name]) => name);

  return {
    pass: failedChecks.length === 0,
    failedChecks,
    failedCheckSample: failedChecks[0] ?? null,
    checks,
  };
};

const createV130CloseoutCapture = (
  root: M10TrustControlsBridgeWindow,
  params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>,
): M10V130CloseoutCapture => {
  const cp4CloseoutCapture = createCp4CloseoutCapture(root, params);
  emitCp4CloseoutGateEvent(cp4CloseoutCapture);
  const digestSummaryAfterCloseoutEvent = readCp2TriageDigestSummary(root, cp4CloseoutCapture.eventWindowSize);
  return {
    generatedAtUnixMs: Date.now(),
    eventWindowSize: cp4CloseoutCapture.eventWindowSize,
    expectedStable: cp4CloseoutCapture.expectedStable,
    cp4CloseoutCapture,
    digestSummaryAfterCloseoutEvent,
    v130CloseoutGate: buildV130CloseoutGate({
      expectedStable: cp4CloseoutCapture.expectedStable,
      cp4CloseoutCapture,
      digestSummaryAfterCloseoutEvent,
    }),
  };
};

const emitV130CloseoutGateEvent = (capture: M10V130CloseoutCapture): void => {
  const digestSummary = capture.digestSummaryAfterCloseoutEvent;
  logAppEvent({
    name: V130_CLOSEOUT_GATE_EVENT_NAME,
    level: capture.v130CloseoutGate.pass ? "info" : "warn",
    scope: { feature: "messaging", action: "m10_trust_controls" },
    context: {
      expectedStable: capture.expectedStable,
      v130CloseoutPass: capture.v130CloseoutGate.pass,
      failedCheckCount: capture.v130CloseoutGate.failedChecks.length,
      failedCheckSample: capture.v130CloseoutGate.failedCheckSample,
      cp4CloseoutPass: capture.cp4CloseoutCapture.cp4CloseoutGate.pass,
      incomingRequestRiskLevel: digestSummary.incomingRequestAntiAbuse?.riskLevel ?? "none",
      uiResponsivenessRiskLevel: digestSummary.uiResponsiveness?.riskLevel ?? "none",
      m10TrustControlsRiskLevel: digestSummary.m10TrustControls?.riskLevel ?? "none",
      cp4CloseoutGateCount: digestSummary.m10TrustControls?.cp4CloseoutGateCount ?? 0,
      cp4CloseoutUnexpectedFailCount: (
        digestSummary.m10TrustControls?.cp4CloseoutGateUnexpectedFailCount ?? 0
      ),
    },
  });
};

const buildV130EvidenceGate = (params: Readonly<{
  expectedStable: boolean;
  v130CloseoutCapture: M10V130CloseoutCapture;
  digestSummaryAfterV130Event: M10Cp2TriageDigestSummary;
  v130CloseoutEventContexts: ReadonlyArray<MinimalAppEvent>;
}>): M10V130EvidenceGate => {
  const digestSummary = params.digestSummaryAfterV130Event;
  const latestV130Event = params.v130CloseoutEventContexts.at(-1);
  const latestV130EventMatchesGate = (
    latestV130Event?.context?.v130CloseoutPass === params.v130CloseoutCapture.v130CloseoutGate.pass
    && latestV130Event?.context?.expectedStable === params.expectedStable
  );
  const checks = {
    expectedStable: params.expectedStable,
    v130CloseoutPass: (
      !params.expectedStable
      || params.v130CloseoutCapture.v130CloseoutGate.pass
    ),
    digestSummaryPresent: (
      !params.expectedStable
      || digestSummary.incomingRequestAntiAbuse !== null
      || digestSummary.uiResponsiveness !== null
      || digestSummary.m10TrustControls !== null
    ),
    incomingRequestRiskNotHigh: (
      !params.expectedStable
      || digestSummary.incomingRequestAntiAbuse?.riskLevel !== "high"
    ),
    uiResponsivenessRiskNotHigh: (
      !params.expectedStable
      || digestSummary.uiResponsiveness?.riskLevel !== "high"
    ),
    m10TrustControlsRiskNotHigh: (
      !params.expectedStable
      || digestSummary.m10TrustControls?.riskLevel !== "high"
    ),
    cp4CloseoutGateObserved: (
      !params.expectedStable
      || (digestSummary.m10TrustControls?.cp4CloseoutGateCount ?? 0) > 0
    ),
    v130CloseoutGateObserved: (
      !params.expectedStable
      || params.v130CloseoutEventContexts.length > 0
    ),
    latestV130EventMatchesGate: (
      !params.expectedStable
      || latestV130EventMatchesGate
    ),
    v130CloseoutUnexpectedFailCountZero: (
      !params.expectedStable
      || (digestSummary.m10TrustControls?.v130CloseoutGateUnexpectedFailCount ?? 0) === 0
    ),
  } as const;

  const failedChecks = Object.entries(checks)
    .filter(([name, passed]) => name !== "expectedStable" && passed !== true)
    .map(([name]) => name);

  return {
    pass: failedChecks.length === 0,
    failedChecks,
    failedCheckSample: failedChecks[0] ?? null,
    checks,
  };
};

const createV130EvidenceCapture = (
  root: M10TrustControlsBridgeWindow,
  params?: Readonly<{
    eventWindowSize?: number;
    expectedStable?: boolean;
  }>,
): M10V130EvidenceCapture => {
  const v130CloseoutCapture = createV130CloseoutCapture(root, params);
  emitV130CloseoutGateEvent(v130CloseoutCapture);
  const eventWindowSize = v130CloseoutCapture.eventWindowSize;
  const digestSummaryAfterV130Event = readCp2TriageDigestSummary(root, eventWindowSize);
  const cp4CloseoutEventContexts = readEventsByName(root, CP4_CLOSEOUT_GATE_EVENT_NAME, eventWindowSize);
  const v130CloseoutEventContexts = readEventsByName(root, V130_CLOSEOUT_GATE_EVENT_NAME, eventWindowSize);
  return {
    generatedAtUnixMs: Date.now(),
    eventWindowSize,
    expectedStable: v130CloseoutCapture.expectedStable,
    v130CloseoutCapture,
    digestSummaryAfterV130Event,
    cp4CloseoutEventContexts,
    v130CloseoutEventContexts,
    v130EvidenceGate: buildV130EvidenceGate({
      expectedStable: v130CloseoutCapture.expectedStable,
      v130CloseoutCapture,
      digestSummaryAfterV130Event,
      v130CloseoutEventContexts,
    }),
  };
};

const emitV130EvidenceGateEvent = (capture: M10V130EvidenceCapture): void => {
  const digestSummary = capture.digestSummaryAfterV130Event;
  logAppEvent({
    name: V130_EVIDENCE_GATE_EVENT_NAME,
    level: capture.v130EvidenceGate.pass ? "info" : "warn",
    scope: { feature: "messaging", action: "m10_trust_controls" },
    context: {
      expectedStable: capture.expectedStable,
      v130EvidencePass: capture.v130EvidenceGate.pass,
      failedCheckCount: capture.v130EvidenceGate.failedChecks.length,
      failedCheckSample: capture.v130EvidenceGate.failedCheckSample,
      v130CloseoutPass: capture.v130CloseoutCapture.v130CloseoutGate.pass,
      cp4CloseoutPass: capture.v130CloseoutCapture.cp4CloseoutCapture.cp4CloseoutGate.pass,
      incomingRequestRiskLevel: digestSummary.incomingRequestAntiAbuse?.riskLevel ?? "none",
      uiResponsivenessRiskLevel: digestSummary.uiResponsiveness?.riskLevel ?? "none",
      m10TrustControlsRiskLevel: digestSummary.m10TrustControls?.riskLevel ?? "none",
      cp4CloseoutGateCount: digestSummary.m10TrustControls?.cp4CloseoutGateCount ?? 0,
      v130CloseoutGateCount: digestSummary.m10TrustControls?.v130CloseoutGateCount ?? 0,
      v130CloseoutUnexpectedFailCount: (
        digestSummary.m10TrustControls?.v130CloseoutGateUnexpectedFailCount ?? 0
      ),
      v130CloseoutEventCount: capture.v130CloseoutEventContexts.length,
      latestV130EventMatchesGate: capture.v130EvidenceGate.checks.latestV130EventMatchesGate,
    },
  });
};

export const installM10TrustControlsBridge = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const root = window as M10TrustControlsBridgeWindow;
  if (root.obscurM10TrustControls) {
    return;
  }
  root.obscurM10TrustControls = {
    getSnapshot: () => createSnapshot(),
    setAttackModeSafetyProfile: (profile) => {
      setAttackModeSafetyProfile(profile);
      return getAttackModeSafetyProfile();
    },
    replaceSignedSharedIntelSignals: (signals) => {
      setSignedSharedIntelSignals(signals);
      return getSignedSharedIntelSignals().length;
    },
    ingestSignedSharedIntelSignals: (params) => ingestSignedSharedIntelSignals({
      signals: params.signals,
      replaceExisting: params.replaceExisting,
      requireSignatureVerification: params.requireSignatureVerification,
    }),
    ingestSignedSharedIntelSignalsJson: (params) => {
      try {
        const parsed = JSON.parse(params.payloadJson) as unknown;
        const signals = Array.isArray(parsed)
          ? parsed
          : (
            parsed
            && typeof parsed === "object"
            && Array.isArray((parsed as { signals?: unknown }).signals)
          )
            ? ((parsed as { signals: unknown[] }).signals)
            : [parsed];
        return ingestSignedSharedIntelSignals({
          signals,
          replaceExisting: params.replaceExisting,
          requireSignatureVerification: params.requireSignatureVerification,
        });
      } catch {
        return toJsonErrorIngestResult();
      }
    },
    exportSignedSharedIntelSignalsJson: () => (
      JSON.stringify(getSignedSharedIntelSignals(), null, 2)
    ),
    clearSignedSharedIntelSignals: () => {
      clearSignedSharedIntelSignals();
    },
    capture: (eventWindowSize = 300) => {
      const safeWindow = toWindowSize(eventWindowSize, 300);
      return createCapture(root, safeWindow);
    },
    captureJson: (eventWindowSize = 300) => (
      JSON.stringify(root.obscurM10TrustControls?.capture(eventWindowSize) ?? null, null, 2)
    ),
    runCp2TriageCapture: (params) => (
      createCp2TriageCapture(root, params)
    ),
    runCp2TriageCaptureJson: (params) => (
      JSON.stringify(root.obscurM10TrustControls?.runCp2TriageCapture(params) ?? null, null, 2)
    ),
    runCp2StabilityGateProbe: (params) => {
      const probe = createCp2TriageCapture(root, params);
      emitCp2StabilityGateEvent(probe);
      return probe;
    },
    runCp2StabilityGateProbeJson: (params) => (
      JSON.stringify(root.obscurM10TrustControls?.runCp2StabilityGateProbe(params) ?? null, null, 2)
    ),
    runCp3ReadinessCapture: (params) => {
      const capture = createCp3ReadinessCapture(root, params);
      emitCp3ReadinessGateEvent(capture);
      return capture;
    },
    runCp3ReadinessCaptureJson: (params) => (
      JSON.stringify(root.obscurM10TrustControls?.runCp3ReadinessCapture(params) ?? null, null, 2)
    ),
    runCp3ReadinessGateProbe: (params) => (
      root.obscurM10TrustControls?.runCp3ReadinessCapture(params).cp3ReadinessGate ?? {
        pass: false,
        failedChecks: ["bridge_unavailable"],
        failedCheckSample: "bridge_unavailable",
        checks: {
          expectedStable: params?.expectedStable !== false,
          hasSnapshot: false,
          hasDigestSummary: false,
          cp2TriagePass: false,
          incomingRequestRiskNotHigh: false,
          uiResponsivenessRiskNotHigh: false,
          m10TrustControlsRiskNotHigh: false,
          cp2UnexpectedFailCountZero: false,
        },
      }
    ),
    runCp3ReadinessGateProbeJson: (params) => (
      JSON.stringify(root.obscurM10TrustControls?.runCp3ReadinessGateProbe(params) ?? null, null, 2)
    ),
    runCp3SuiteCapture: (params) => {
      const capture = createCp3SuiteCapture(root, params);
      emitCp3SuiteGateEvent(capture);
      return capture;
    },
    runCp3SuiteCaptureJson: (params) => (
      JSON.stringify(root.obscurM10TrustControls?.runCp3SuiteCapture(params) ?? null, null, 2)
    ),
    runCp3SuiteGateProbe: (params) => (
      root.obscurM10TrustControls?.runCp3SuiteCapture(params).cp3SuiteGate ?? {
        pass: false,
        failedChecks: ["bridge_unavailable"],
        failedCheckSample: "bridge_unavailable",
        checks: {
          expectedStable: params?.expectedStable !== false,
          cp3ReadinessPass: false,
          digestSummaryPresent: false,
          incomingRequestRiskNotHigh: false,
          uiResponsivenessRiskNotHigh: false,
          m10TrustControlsRiskNotHigh: false,
          cp3ReadinessGateObserved: false,
          cp3ReadinessUnexpectedFailCountZero: false,
        },
      }
    ),
    runCp3SuiteGateProbeJson: (params) => (
      JSON.stringify(root.obscurM10TrustControls?.runCp3SuiteGateProbe(params) ?? null, null, 2)
    ),
    runCp4CloseoutCapture: (params) => {
      const capture = createCp4CloseoutCapture(root, params);
      emitCp4CloseoutGateEvent(capture);
      return capture;
    },
    runCp4CloseoutCaptureJson: (params) => (
      JSON.stringify(root.obscurM10TrustControls?.runCp4CloseoutCapture(params) ?? null, null, 2)
    ),
    runCp4CloseoutGateProbe: (params) => (
      root.obscurM10TrustControls?.runCp4CloseoutCapture(params).cp4CloseoutGate ?? {
        pass: false,
        failedChecks: ["bridge_unavailable"],
        failedCheckSample: "bridge_unavailable",
        checks: {
          expectedStable: params?.expectedStable !== false,
          cp3SuitePass: false,
          digestSummaryPresent: false,
          incomingRequestRiskNotHigh: false,
          uiResponsivenessRiskNotHigh: false,
          m10TrustControlsRiskNotHigh: false,
          cp3SuiteGateObserved: false,
          cp3SuiteUnexpectedFailCountZero: false,
        },
      }
    ),
    runCp4CloseoutGateProbeJson: (params) => (
      JSON.stringify(root.obscurM10TrustControls?.runCp4CloseoutGateProbe(params) ?? null, null, 2)
    ),
    runV130CloseoutCapture: (params) => {
      const capture = createV130CloseoutCapture(root, params);
      emitV130CloseoutGateEvent(capture);
      return capture;
    },
    runV130CloseoutCaptureJson: (params) => (
      JSON.stringify(root.obscurM10TrustControls?.runV130CloseoutCapture(params) ?? null, null, 2)
    ),
    runV130CloseoutGateProbe: (params) => (
      root.obscurM10TrustControls?.runV130CloseoutCapture(params).v130CloseoutGate ?? {
        pass: false,
        failedChecks: ["bridge_unavailable"],
        failedCheckSample: "bridge_unavailable",
        checks: {
          expectedStable: params?.expectedStable !== false,
          cp4CloseoutPass: false,
          digestSummaryPresent: false,
          incomingRequestRiskNotHigh: false,
          uiResponsivenessRiskNotHigh: false,
          m10TrustControlsRiskNotHigh: false,
          cp4CloseoutGateObserved: false,
          cp4CloseoutUnexpectedFailCountZero: false,
        },
      }
    ),
    runV130CloseoutGateProbeJson: (params) => (
      JSON.stringify(root.obscurM10TrustControls?.runV130CloseoutGateProbe(params) ?? null, null, 2)
    ),
    runV130EvidenceCapture: (params) => {
      const capture = createV130EvidenceCapture(root, params);
      emitV130EvidenceGateEvent(capture);
      return capture;
    },
    runV130EvidenceCaptureJson: (params) => (
      JSON.stringify(root.obscurM10TrustControls?.runV130EvidenceCapture(params) ?? null, null, 2)
    ),
    runV130EvidenceGateProbe: (params) => (
      root.obscurM10TrustControls?.runV130EvidenceCapture(params).v130EvidenceGate ?? {
        pass: false,
        failedChecks: ["bridge_unavailable"],
        failedCheckSample: "bridge_unavailable",
        checks: {
          expectedStable: params?.expectedStable !== false,
          v130CloseoutPass: false,
          digestSummaryPresent: false,
          incomingRequestRiskNotHigh: false,
          uiResponsivenessRiskNotHigh: false,
          m10TrustControlsRiskNotHigh: false,
          cp4CloseoutGateObserved: false,
          v130CloseoutGateObserved: false,
          latestV130EventMatchesGate: false,
          v130CloseoutUnexpectedFailCountZero: false,
        },
      }
    ),
    runV130EvidenceGateProbeJson: (params) => (
      JSON.stringify(root.obscurM10TrustControls?.runV130EvidenceGateProbe(params) ?? null, null, 2)
    ),
  };
};

export const m10TrustControlsBridgeInternals = {
  ATTACK_MODE_REASON_PREFIX,
  CP2_STABILITY_GATE_EVENT_NAME,
  CP3_READINESS_GATE_EVENT_NAME,
  CP3_SUITE_GATE_EVENT_NAME,
  CP4_CLOSEOUT_GATE_EVENT_NAME,
  V130_CLOSEOUT_GATE_EVENT_NAME,
  V130_EVIDENCE_GATE_EVENT_NAME,
  TRUST_CONTROL_EVENT_NAMES,
  RESPONSIVENESS_EVENT_NAMES,
  buildV130EvidenceGate,
  buildV130CloseoutGate,
  buildCp4CloseoutGate,
  buildCp3SuiteGate,
  buildCp3ReadinessGate,
  buildCp2TriageGate,
  createV130CloseoutCapture,
  createV130EvidenceCapture,
  createCp4CloseoutCapture,
  createCp3SuiteCapture,
  createCp3ReadinessCapture,
  createCp2TriageCapture,
  createSnapshot,
  createCapture,
  emitV130CloseoutGateEvent,
  emitV130EvidenceGateEvent,
  emitCp4CloseoutGateEvent,
  emitCp3SuiteGateEvent,
  emitCp3ReadinessGateEvent,
  emitCp2StabilityGateEvent,
  readAttackModeQuarantineEvents,
  readCp2TriageDigestSummary,
  readResponsivenessEvents,
  readEventsByName,
  readTrustControlEvents,
  toWindowSize,
};
