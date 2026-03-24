import type { RealtimeVoiceUnsupportedReasonCode } from "@/app/features/messaging/services/realtime-voice-capability";
import {
  createInitialRealtimeVoiceSessionState,
  type RealtimeVoiceSessionMode,
  type RealtimeVoiceSessionState,
} from "@/app/features/messaging/services/realtime-voice-session-lifecycle";
import { createRealtimeVoiceSessionOwner } from "@/app/features/messaging/services/realtime-voice-session-owner";
import type { M6VoiceCaptureBundle } from "@/app/shared/m6-voice-capture";

type M6WeakNetworkReplayParams = Readonly<{
  roomId?: string;
  mode?: RealtimeVoiceSessionMode;
  baseUnixMs?: number;
  maxRecoveryAttempts?: number;
  captureWindowSize?: number;
  clearAppEvents?: boolean;
}>;

type M6VoiceDigestSummary = NonNullable<M6VoiceCaptureBundle["voice"]["summary"]>;

type M6VoiceReplayResult = Readonly<{
  generatedAtUnixMs: number;
  replayBaseUnixMs: number;
  finalState: RealtimeVoiceSessionState;
  transitionEventCount: number;
  degradedTransitionCount: number;
  recoveredActiveTransitionCount: number;
  ignoredEventCount: number;
  latestDigestSummary: M6VoiceDigestSummary | null;
  replayReadiness: Readonly<{
    hasTransitionEvents: boolean;
    hasDegradedTransition: boolean;
    hasRecoveredActiveTransition: boolean;
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
    hasReplayResult: boolean;
    hasCaptureBundle: boolean;
    hasTransitionEvents: boolean;
    hasDegradedTransition: boolean;
    hasRecoveredActiveTransition: boolean;
    hasIgnoredEventSlice: boolean;
    hasDigestSummary: boolean;
    digestHasIgnoredFieldCoverage: boolean;
    replayRiskNotHigh: boolean;
    replayReadyForCp2: boolean;
  }>;
}>;

type M6VoiceReplayCaptureBundle = Readonly<{
  replay: M6VoiceReplayResult | null;
  capture: M6VoiceCaptureBundle | null;
  cp2EvidenceGate: M6VoiceCp2EvidenceGate;
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
  transitionEventCount: number;
  degradedTransitionCount: number;
  recoveredActiveTransitionCount: number;
  latestDigestSummary: M6VoiceDigestSummary | null;
}>): M6VoiceReplayResult["replayReadiness"] => {
  const hasTransitionEvents = params.transitionEventCount >= DEFAULT_WEAK_REPLAY_TRANSITION_COUNT;
  const hasDegradedTransition = params.degradedTransitionCount >= 1;
  const hasRecoveredActiveTransition = params.recoveredActiveTransitionCount >= 1;
  const digestHasTransitionCount = (params.latestDigestSummary?.transitionCount ?? 0) >= 1;
  const digestHasDegradedCount = (params.latestDigestSummary?.degradedCount ?? 0) >= 1;
  const digestHasIgnoredFieldCoverage = params.latestDigestSummary !== null
    && typeof params.latestDigestSummary.staleEventIgnoredCount === "number"
    && Object.prototype.hasOwnProperty.call(params.latestDigestSummary, "latestIgnoredReasonCode");
  const riskNotHigh = params.latestDigestSummary?.riskLevel !== "high";
  return {
    hasTransitionEvents,
    hasDegradedTransition,
    hasRecoveredActiveTransition,
    digestHasTransitionCount,
    digestHasDegradedCount,
    digestHasIgnoredFieldCoverage,
    riskNotHigh,
    readyForCp2Evidence: (
      hasTransitionEvents
      && hasDegradedTransition
      && hasRecoveredActiveTransition
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
  const checks = {
    hasReplayResult: replay !== null,
    hasCaptureBundle: capture !== null,
    hasTransitionEvents: (replay?.transitionEventCount ?? 0) >= DEFAULT_WEAK_REPLAY_TRANSITION_COUNT,
    hasDegradedTransition: (replay?.degradedTransitionCount ?? 0) >= 1,
    hasRecoveredActiveTransition: (replay?.recoveredActiveTransitionCount ?? 0) >= 1,
    hasIgnoredEventSlice: Array.isArray(capture?.voice?.ignoredEvents),
    hasDigestSummary: replay?.latestDigestSummary !== null,
    digestHasIgnoredFieldCoverage: replay?.replayReadiness?.digestHasIgnoredFieldCoverage === true,
    replayRiskNotHigh: replay?.latestDigestSummary?.riskLevel !== "high",
    replayReadyForCp2: replay?.replayReadiness?.readyForCp2Evidence === true,
  } as const;

  const failedChecks = Object.entries(checks)
    .filter(([, pass]) => pass !== true)
    .map(([key]) => key);

  return {
    pass: failedChecks.length === 0,
    failedChecks,
    checks,
  };
};

export const installM6VoiceReplayBridge = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const root = window as M6VoiceReplayWindow;
  if (root.obscurM6VoiceReplay) {
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
      lastReplay = {
        generatedAtUnixMs: Date.now(),
        replayBaseUnixMs,
        finalState: state,
        transitionEventCount: transitions.length,
        degradedTransitionCount: countTransitionsToPhase(transitions, "degraded"),
        recoveredActiveTransitionCount: countRecoveredActiveTransitions(transitions),
        ignoredEventCount: ignoredEvents.length,
        latestDigestSummary,
        replayReadiness: buildReplayReadiness({
          transitionEventCount: transitions.length,
          degradedTransitionCount: countTransitionsToPhase(transitions, "degraded"),
          recoveredActiveTransitionCount: countRecoveredActiveTransitions(transitions),
          latestDigestSummary,
        }),
      };
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
  };
};

export const m6VoiceReplayBridgeInternals = {
  buildCp2EvidenceGate,
  buildReplayReadiness,
  countRecoveredActiveTransitions,
  parseDigestSummary,
  toPositiveInteger,
};
