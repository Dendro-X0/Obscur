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
  const responsiveness = summary?.uiResponsiveness;
  return {
    incomingRequestAntiAbuse: incoming ? {
      riskLevel: toRiskLevel(incoming.riskLevel),
      quarantinedCount: toNumber(incoming.quarantinedCount),
      latestReasonCode: toStringOrNull(incoming.latestReasonCode),
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
  };
};

export const m10TrustControlsBridgeInternals = {
  ATTACK_MODE_REASON_PREFIX,
  CP2_STABILITY_GATE_EVENT_NAME,
  TRUST_CONTROL_EVENT_NAMES,
  RESPONSIVENESS_EVENT_NAMES,
  buildCp2TriageGate,
  createCp2TriageCapture,
  createSnapshot,
  createCapture,
  emitCp2StabilityGateEvent,
  readAttackModeQuarantineEvents,
  readCp2TriageDigestSummary,
  readResponsivenessEvents,
  readTrustControlEvents,
  toWindowSize,
};
