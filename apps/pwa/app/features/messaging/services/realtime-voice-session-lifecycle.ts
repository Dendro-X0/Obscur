import type {
  RealtimeVoiceCapability,
  RealtimeVoiceUnsupportedReasonCode,
} from "./realtime-voice-capability";

export type RealtimeVoiceSessionMode = "create" | "join";

export type RealtimeVoiceSessionPhase =
  | "idle"
  | "connecting"
  | "active"
  | "degraded"
  | "leaving"
  | "ended"
  | "unsupported";

export type RealtimeVoiceSessionDegradedReasonCode =
  | "opus_codec_missing"
  | "network_degraded"
  | "transport_timeout"
  | "peer_evidence_missing";

export type RealtimeVoiceSessionReasonCode =
  | "none"
  | "left_by_user"
  | "session_closed"
  | "invalid_transition"
  | "recovery_exhausted"
  | RealtimeVoiceUnsupportedReasonCode
  | RealtimeVoiceSessionDegradedReasonCode;

export type RealtimeVoiceSessionState = Readonly<{
  roomId: string | null;
  mode: RealtimeVoiceSessionMode | null;
  phase: RealtimeVoiceSessionPhase;
  participantCount: number;
  hasPeerSessionEvidence: boolean;
  recoveryAttemptCount: number;
  maxRecoveryAttempts: number;
  lastTransitionReasonCode: RealtimeVoiceSessionReasonCode;
  lastTransitionAtUnixMs: number | null;
}>;

const DEFAULT_MAX_RECOVERY_ATTEMPTS = 3;

const normalizeMaxRecoveryAttempts = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MAX_RECOVERY_ATTEMPTS;
  }
  return Math.max(1, Math.trunc(value));
};

const withTransition = (
  state: RealtimeVoiceSessionState,
  transition: Readonly<{
    phase: RealtimeVoiceSessionPhase;
    reasonCode: RealtimeVoiceSessionReasonCode;
    nowUnixMs?: number;
    participantCount?: number;
    hasPeerSessionEvidence?: boolean;
    roomId?: string | null;
    mode?: RealtimeVoiceSessionMode | null;
    recoveryAttemptCount?: number;
    maxRecoveryAttempts?: number;
  }>,
): RealtimeVoiceSessionState => ({
  roomId: transition.roomId === undefined ? state.roomId : transition.roomId,
  mode: transition.mode === undefined ? state.mode : transition.mode,
  phase: transition.phase,
  participantCount:
    transition.participantCount === undefined
      ? state.participantCount
      : transition.participantCount,
  hasPeerSessionEvidence:
    transition.hasPeerSessionEvidence === undefined
      ? state.hasPeerSessionEvidence
      : transition.hasPeerSessionEvidence,
  recoveryAttemptCount:
    transition.recoveryAttemptCount === undefined
      ? state.recoveryAttemptCount
      : transition.recoveryAttemptCount,
  maxRecoveryAttempts:
    transition.maxRecoveryAttempts === undefined
      ? state.maxRecoveryAttempts
      : normalizeMaxRecoveryAttempts(transition.maxRecoveryAttempts),
  lastTransitionReasonCode: transition.reasonCode,
  lastTransitionAtUnixMs: transition.nowUnixMs ?? Date.now(),
});

export const createInitialRealtimeVoiceSessionState = (
  options?: Readonly<{ maxRecoveryAttempts?: number }>,
): RealtimeVoiceSessionState => ({
  roomId: null,
  mode: null,
  phase: "idle",
  participantCount: 0,
  hasPeerSessionEvidence: false,
  recoveryAttemptCount: 0,
  maxRecoveryAttempts: normalizeMaxRecoveryAttempts(options?.maxRecoveryAttempts),
  lastTransitionReasonCode: "none",
  lastTransitionAtUnixMs: null,
});

export const startRealtimeVoiceSession = (
  state: RealtimeVoiceSessionState,
  params: Readonly<{
    roomId: string;
    mode: RealtimeVoiceSessionMode;
    capability: RealtimeVoiceCapability;
    nowUnixMs?: number;
    maxRecoveryAttempts?: number;
  }>,
): RealtimeVoiceSessionState => {
  if (state.phase !== "idle" && state.phase !== "ended") {
    return withTransition(state, {
      phase: state.phase,
      reasonCode: "invalid_transition",
      nowUnixMs: params.nowUnixMs,
    });
  }

  const maxRecoveryAttempts =
    params.maxRecoveryAttempts === undefined
      ? state.maxRecoveryAttempts
      : normalizeMaxRecoveryAttempts(params.maxRecoveryAttempts);

  if (!params.capability.supported) {
    return withTransition(state, {
      roomId: params.roomId,
      mode: params.mode,
      phase: "unsupported",
      participantCount: 0,
      hasPeerSessionEvidence: false,
      recoveryAttemptCount: 0,
      maxRecoveryAttempts,
      reasonCode: params.capability.reasonCode as RealtimeVoiceUnsupportedReasonCode,
      nowUnixMs: params.nowUnixMs,
    });
  }

  if (params.capability.opusCapabilityStatus === "missing") {
    return withTransition(state, {
      roomId: params.roomId,
      mode: params.mode,
      phase: "degraded",
      participantCount: 1,
      hasPeerSessionEvidence: false,
      recoveryAttemptCount: 0,
      maxRecoveryAttempts,
      reasonCode: "opus_codec_missing",
      nowUnixMs: params.nowUnixMs,
    });
  }

  return withTransition(state, {
    roomId: params.roomId,
    mode: params.mode,
    phase: "connecting",
    participantCount: 1,
    hasPeerSessionEvidence: false,
    recoveryAttemptCount: 0,
    maxRecoveryAttempts,
    reasonCode: "none",
    nowUnixMs: params.nowUnixMs,
  });
};

export const markRealtimeVoiceSessionConnected = (
  state: RealtimeVoiceSessionState,
  params: Readonly<{
    participantCount: number;
    hasPeerSessionEvidence: boolean;
    nowUnixMs?: number;
  }>,
): RealtimeVoiceSessionState => {
  if (
    state.phase !== "connecting"
    && state.phase !== "degraded"
    && state.phase !== "active"
  ) {
    return withTransition(state, {
      phase: state.phase,
      reasonCode: "invalid_transition",
      nowUnixMs: params.nowUnixMs,
    });
  }

  if (!params.hasPeerSessionEvidence || params.participantCount < 2) {
    return withTransition(state, {
      phase: "degraded",
      participantCount: Math.max(1, Math.trunc(params.participantCount)),
      hasPeerSessionEvidence: false,
      reasonCode: "peer_evidence_missing",
      nowUnixMs: params.nowUnixMs,
    });
  }

  return withTransition(state, {
    phase: "active",
    participantCount: Math.max(2, Math.trunc(params.participantCount)),
    hasPeerSessionEvidence: true,
    reasonCode: "none",
    nowUnixMs: params.nowUnixMs,
  });
};

export const markRealtimeVoiceSessionTransportDegraded = (
  state: RealtimeVoiceSessionState,
  params: Readonly<{
    reasonCode: Extract<
      RealtimeVoiceSessionDegradedReasonCode,
      "network_degraded" | "transport_timeout"
    >;
    nowUnixMs?: number;
  }>,
): RealtimeVoiceSessionState => {
  if (
    state.phase !== "connecting" &&
    state.phase !== "active" &&
    state.phase !== "degraded"
  ) {
    return withTransition(state, {
      phase: state.phase,
      reasonCode: "invalid_transition",
      nowUnixMs: params.nowUnixMs,
    });
  }

  return withTransition(state, {
    phase: "degraded",
    reasonCode: params.reasonCode,
    nowUnixMs: params.nowUnixMs,
  });
};

export const requestRealtimeVoiceSessionRecovery = (
  state: RealtimeVoiceSessionState,
  params?: Readonly<{ nowUnixMs?: number }>,
): RealtimeVoiceSessionState => {
  if (state.phase !== "degraded") {
    return withTransition(state, {
      phase: state.phase,
      reasonCode: "invalid_transition",
      nowUnixMs: params?.nowUnixMs,
    });
  }

  if (state.recoveryAttemptCount >= state.maxRecoveryAttempts) {
    return withTransition(state, {
      phase: "ended",
      participantCount: 0,
      hasPeerSessionEvidence: false,
      reasonCode: "recovery_exhausted",
      nowUnixMs: params?.nowUnixMs,
    });
  }

  return withTransition(state, {
    phase: "connecting",
    participantCount: Math.max(1, state.participantCount),
    hasPeerSessionEvidence: false,
    recoveryAttemptCount: state.recoveryAttemptCount + 1,
    reasonCode: "none",
    nowUnixMs: params?.nowUnixMs,
  });
};

export const markRealtimeVoiceSessionRecoveryFailed = (
  state: RealtimeVoiceSessionState,
  params: Readonly<{
    reasonCode: Extract<
      RealtimeVoiceSessionDegradedReasonCode,
      "network_degraded" | "transport_timeout"
    >;
    nowUnixMs?: number;
  }>,
): RealtimeVoiceSessionState => {
  if (state.phase !== "connecting") {
    return withTransition(state, {
      phase: state.phase,
      reasonCode: "invalid_transition",
      nowUnixMs: params.nowUnixMs,
    });
  }

  if (state.recoveryAttemptCount >= state.maxRecoveryAttempts) {
    return withTransition(state, {
      phase: "ended",
      participantCount: 0,
      hasPeerSessionEvidence: false,
      reasonCode: "recovery_exhausted",
      nowUnixMs: params.nowUnixMs,
    });
  }

  return withTransition(state, {
    phase: "degraded",
    participantCount: Math.max(1, state.participantCount),
    hasPeerSessionEvidence: false,
    reasonCode: params.reasonCode,
    nowUnixMs: params.nowUnixMs,
  });
};

export const requestRealtimeVoiceSessionLeave = (
  state: RealtimeVoiceSessionState,
  params?: Readonly<{ nowUnixMs?: number }>,
): RealtimeVoiceSessionState => {
  if (
    state.phase !== "connecting" &&
    state.phase !== "active" &&
    state.phase !== "degraded"
  ) {
    return withTransition(state, {
      phase: state.phase,
      reasonCode: "invalid_transition",
      nowUnixMs: params?.nowUnixMs,
    });
  }

  return withTransition(state, {
    phase: "leaving",
    reasonCode: "none",
    nowUnixMs: params?.nowUnixMs,
  });
};

export const markRealtimeVoiceSessionLeft = (
  state: RealtimeVoiceSessionState,
  params?: Readonly<{ nowUnixMs?: number; reasonCode?: "left_by_user" | "session_closed" }>,
): RealtimeVoiceSessionState => {
  if (state.phase === "ended") {
    return state;
  }

  if (state.phase !== "leaving") {
    return withTransition(state, {
      phase: state.phase,
      reasonCode: "invalid_transition",
      nowUnixMs: params?.nowUnixMs,
    });
  }

  return withTransition(state, {
    phase: "ended",
    participantCount: 0,
    hasPeerSessionEvidence: false,
    reasonCode: params?.reasonCode ?? "left_by_user",
    nowUnixMs: params?.nowUnixMs,
  });
};

export const markRealtimeVoiceSessionClosed = (
  state: RealtimeVoiceSessionState,
  params?: Readonly<{ nowUnixMs?: number }>,
): RealtimeVoiceSessionState => {
  if (state.phase === "ended") {
    return state;
  }

  if (
    state.phase !== "connecting"
    && state.phase !== "active"
    && state.phase !== "degraded"
    && state.phase !== "leaving"
  ) {
    return withTransition(state, {
      phase: state.phase,
      reasonCode: "invalid_transition",
      nowUnixMs: params?.nowUnixMs,
    });
  }

  return withTransition(state, {
    phase: "ended",
    participantCount: 0,
    hasPeerSessionEvidence: false,
    reasonCode: "session_closed",
    nowUnixMs: params?.nowUnixMs,
  });
};

export const isRealtimeVoiceSessionInteractive = (
  state: RealtimeVoiceSessionState,
): boolean => state.phase === "connecting" || state.phase === "active" || state.phase === "degraded";
