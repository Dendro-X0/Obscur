import type { RealtimeVoiceCapability } from "./realtime-voice-capability";
import { emitRealtimeVoiceSessionTransitionDiagnostic } from "./realtime-voice-session-diagnostics";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  createInitialRealtimeVoiceSessionState,
  markRealtimeVoiceSessionClosed,
  markRealtimeVoiceSessionConnected,
  markRealtimeVoiceSessionLeft,
  markRealtimeVoiceSessionRecoveryFailed,
  markRealtimeVoiceSessionTransportDegraded,
  requestRealtimeVoiceSessionLeave,
  requestRealtimeVoiceSessionRecovery,
  startRealtimeVoiceSession,
  type RealtimeVoiceSessionDegradedReasonCode,
  type RealtimeVoiceSessionMode,
  type RealtimeVoiceSessionState,
} from "./realtime-voice-session-lifecycle";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const shouldIgnoreStaleEvent = (
  state: RealtimeVoiceSessionState,
  eventUnixMs: number | undefined,
): boolean => (
  isFiniteNumber(eventUnixMs)
  && isFiniteNumber(state.lastTransitionAtUnixMs)
  && eventUnixMs < state.lastTransitionAtUnixMs
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

type RealtimeVoiceOwnerTransitionParams = Readonly<{
  eventUnixMs?: number;
}>;

export type RealtimeVoiceSessionOwner = Readonly<{
  getState: () => RealtimeVoiceSessionState;
  reset: (options?: Readonly<{ maxRecoveryAttempts?: number }>) => RealtimeVoiceSessionState;
  start: (params: Readonly<{
    roomId: string;
    mode: RealtimeVoiceSessionMode;
    capability: RealtimeVoiceCapability;
    maxRecoveryAttempts?: number;
    eventUnixMs?: number;
  }>) => RealtimeVoiceSessionState;
  connected: (params: Readonly<{
    participantCount: number;
    hasPeerSessionEvidence: boolean;
    eventUnixMs?: number;
  }>) => RealtimeVoiceSessionState;
  transportDegraded: (params: Readonly<{
    reasonCode: Extract<
      RealtimeVoiceSessionDegradedReasonCode,
      "network_degraded" | "transport_timeout"
    >;
    eventUnixMs?: number;
  }>) => RealtimeVoiceSessionState;
  requestRecovery: (params?: RealtimeVoiceOwnerTransitionParams) => RealtimeVoiceSessionState;
  recoveryFailed: (params: Readonly<{
    reasonCode: Extract<
      RealtimeVoiceSessionDegradedReasonCode,
      "network_degraded" | "transport_timeout"
    >;
    eventUnixMs?: number;
  }>) => RealtimeVoiceSessionState;
  requestLeave: (params?: RealtimeVoiceOwnerTransitionParams) => RealtimeVoiceSessionState;
  left: (params?: Readonly<{
    reasonCode?: "left_by_user" | "session_closed";
    eventUnixMs?: number;
  }>) => RealtimeVoiceSessionState;
  closed: (params?: RealtimeVoiceOwnerTransitionParams) => RealtimeVoiceSessionState;
}>;

export const createRealtimeVoiceSessionOwner = (
  options?: Readonly<{
    maxRecoveryAttempts?: number;
  }>,
): RealtimeVoiceSessionOwner => {
  let state = createInitialRealtimeVoiceSessionState({
    maxRecoveryAttempts: options?.maxRecoveryAttempts,
  });

  const apply = (
    eventUnixMs: number | undefined,
    transition: (params: Readonly<{ nowUnixMs?: number }>) => RealtimeVoiceSessionState,
  ): RealtimeVoiceSessionState => {
    if (shouldIgnoreStaleEvent(state, eventUnixMs)) {
      logAppEvent({
        name: "messaging.realtime_voice.session_event_ignored",
        level: "info",
        scope: { feature: "messaging", action: "realtime_voice_session" },
        context: {
          reasonCode: "stale_event",
          roomIdHint: toRoomIdHint(state.roomId),
          phase: state.phase,
          mode: state.mode,
          eventUnixMs: isFiniteNumber(eventUnixMs) ? eventUnixMs : null,
          lastTransitionAtUnixMs: isFiniteNumber(state.lastTransitionAtUnixMs)
            ? state.lastTransitionAtUnixMs
            : null,
        },
      });
      return state;
    }
    const previous = state;
    const next = transition({ nowUnixMs: isFiniteNumber(eventUnixMs) ? eventUnixMs : undefined });
    state = next;
    emitRealtimeVoiceSessionTransitionDiagnostic({
      previousState: previous,
      nextState: next,
    });
    return state;
  };

  return {
    getState: () => state,
    reset: (resetOptions) => {
      state = createInitialRealtimeVoiceSessionState(resetOptions);
      return state;
    },
    start: (params) => apply(params.eventUnixMs, ({ nowUnixMs }) => (
      startRealtimeVoiceSession(state, {
        roomId: params.roomId,
        mode: params.mode,
        capability: params.capability,
        maxRecoveryAttempts: params.maxRecoveryAttempts,
        nowUnixMs,
      })
    )),
    connected: (params) => apply(params.eventUnixMs, ({ nowUnixMs }) => (
      markRealtimeVoiceSessionConnected(state, {
        participantCount: params.participantCount,
        hasPeerSessionEvidence: params.hasPeerSessionEvidence,
        nowUnixMs,
      })
    )),
    transportDegraded: (params) => apply(params.eventUnixMs, ({ nowUnixMs }) => (
      markRealtimeVoiceSessionTransportDegraded(state, {
        reasonCode: params.reasonCode,
        nowUnixMs,
      })
    )),
    requestRecovery: (params) => apply(params?.eventUnixMs, ({ nowUnixMs }) => (
      requestRealtimeVoiceSessionRecovery(state, { nowUnixMs })
    )),
    recoveryFailed: (params) => apply(params.eventUnixMs, ({ nowUnixMs }) => (
      markRealtimeVoiceSessionRecoveryFailed(state, {
        reasonCode: params.reasonCode,
        nowUnixMs,
      })
    )),
    requestLeave: (params) => apply(params?.eventUnixMs, ({ nowUnixMs }) => (
      requestRealtimeVoiceSessionLeave(state, { nowUnixMs })
    )),
    left: (params) => apply(params?.eventUnixMs, ({ nowUnixMs }) => (
      markRealtimeVoiceSessionLeft(state, {
        reasonCode: params?.reasonCode,
        nowUnixMs,
      })
    )),
    closed: (params) => apply(params?.eventUnixMs, ({ nowUnixMs }) => (
      markRealtimeVoiceSessionClosed(state, { nowUnixMs })
    )),
  };
};
