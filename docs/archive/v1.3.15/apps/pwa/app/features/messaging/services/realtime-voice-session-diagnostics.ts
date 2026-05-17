import { logAppEvent } from "@/app/shared/log-app-event";
import type { RealtimeVoiceSessionState } from "./realtime-voice-session-lifecycle";

type RealtimeVoiceSessionTransitionLevel = "info" | "warn";

const toRoomIdHint = (roomId: string | null): string | null => {
  if (typeof roomId !== "string" || roomId.length === 0) {
    return null;
  }
  if (roomId.length <= 16) {
    return roomId;
  }
  return `${roomId.slice(0, 8)}...${roomId.slice(-8)}`;
};

const getTransitionLevel = (nextState: RealtimeVoiceSessionState): RealtimeVoiceSessionTransitionLevel => {
  if (
    nextState.phase === "degraded"
    || nextState.phase === "unsupported"
    || nextState.lastTransitionReasonCode === "invalid_transition"
    || nextState.lastTransitionReasonCode === "recovery_exhausted"
  ) {
    return "warn";
  }
  return "info";
};

const hasTransitionRelevantChange = (
  previousState: RealtimeVoiceSessionState,
  nextState: RealtimeVoiceSessionState,
): boolean => (
  previousState.phase !== nextState.phase
  || previousState.lastTransitionReasonCode !== nextState.lastTransitionReasonCode
  || previousState.participantCount !== nextState.participantCount
  || previousState.hasPeerSessionEvidence !== nextState.hasPeerSessionEvidence
  || previousState.recoveryAttemptCount !== nextState.recoveryAttemptCount
);

export const emitRealtimeVoiceSessionTransitionDiagnostic = (
  params: Readonly<{
    previousState: RealtimeVoiceSessionState;
    nextState: RealtimeVoiceSessionState;
  }>,
): boolean => {
  if (!hasTransitionRelevantChange(params.previousState, params.nextState)) {
    return false;
  }
  const next = params.nextState;
  logAppEvent({
    name: "messaging.realtime_voice.session_transition",
    level: getTransitionLevel(next),
    scope: { feature: "messaging", action: "realtime_voice_session" },
    context: {
      roomIdHint: toRoomIdHint(next.roomId),
      mode: next.mode,
      fromPhase: params.previousState.phase,
      toPhase: next.phase,
      reasonCode: next.lastTransitionReasonCode,
      participantCount: next.participantCount,
      hasPeerSessionEvidence: next.hasPeerSessionEvidence,
      recoveryAttemptCount: next.recoveryAttemptCount,
      maxRecoveryAttempts: next.maxRecoveryAttempts,
      isRecoverable: next.phase === "degraded" && next.recoveryAttemptCount < next.maxRecoveryAttempts,
    },
  });
  return true;
};

export const realtimeVoiceSessionDiagnosticsInternals = {
  getTransitionLevel,
  hasTransitionRelevantChange,
  toRoomIdHint,
};
