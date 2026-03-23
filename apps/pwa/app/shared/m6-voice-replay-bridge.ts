import type { RealtimeVoiceUnsupportedReasonCode } from "@/app/features/messaging/services/realtime-voice-capability";
import {
  createInitialRealtimeVoiceSessionState,
  markRealtimeVoiceSessionConnected,
  markRealtimeVoiceSessionLeft,
  markRealtimeVoiceSessionRecoveryFailed,
  markRealtimeVoiceSessionTransportDegraded,
  requestRealtimeVoiceSessionLeave,
  requestRealtimeVoiceSessionRecovery,
  startRealtimeVoiceSession,
  type RealtimeVoiceSessionMode,
  type RealtimeVoiceSessionState,
} from "@/app/features/messaging/services/realtime-voice-session-lifecycle";
import { emitRealtimeVoiceSessionTransitionDiagnostic } from "@/app/features/messaging/services/realtime-voice-session-diagnostics";

type M6VoiceReplayApi = Readonly<{
  reset: (options?: Readonly<{ maxRecoveryAttempts?: number }>) => RealtimeVoiceSessionState;
  getState: () => RealtimeVoiceSessionState;
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
  runWeakNetworkReplay: (params?: Readonly<{ roomId?: string; mode?: RealtimeVoiceSessionMode }>) => RealtimeVoiceSessionState;
}>;

type M6VoiceReplayWindow = Window & {
  obscurM6VoiceReplay?: M6VoiceReplayApi;
};

declare global {
  interface Window {
    obscurM6VoiceReplay?: M6VoiceReplayApi;
  }
}

const applyTransition = (
  currentState: RealtimeVoiceSessionState,
  nextState: RealtimeVoiceSessionState,
): RealtimeVoiceSessionState => {
  emitRealtimeVoiceSessionTransitionDiagnostic({
    previousState: currentState,
    nextState,
  });
  return nextState;
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

  root.obscurM6VoiceReplay = {
    reset: (options) => {
      state = createInitialRealtimeVoiceSessionState(options);
      return state;
    },
    getState: () => state,
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
      const next = startRealtimeVoiceSession(state, {
        roomId: params?.roomId ?? "m6-voice-room",
        mode: params?.mode ?? "join",
        capability,
        maxRecoveryAttempts: params?.maxRecoveryAttempts,
      });
      state = applyTransition(state, next);
      return state;
    },
    connect: (params) => {
      const next = markRealtimeVoiceSessionConnected(state, {
        participantCount: params?.participantCount ?? 2,
        hasPeerSessionEvidence: params?.hasPeerSessionEvidence ?? true,
      });
      state = applyTransition(state, next);
      return state;
    },
    degrade: (params) => {
      const next = markRealtimeVoiceSessionTransportDegraded(state, {
        reasonCode: params?.reasonCode ?? "network_degraded",
      });
      state = applyTransition(state, next);
      return state;
    },
    requestRecovery: () => {
      const next = requestRealtimeVoiceSessionRecovery(state);
      state = applyTransition(state, next);
      return state;
    },
    failRecovery: (params) => {
      const next = markRealtimeVoiceSessionRecoveryFailed(state, {
        reasonCode: params?.reasonCode ?? "transport_timeout",
      });
      state = applyTransition(state, next);
      return state;
    },
    leave: () => {
      const next = requestRealtimeVoiceSessionLeave(state);
      state = applyTransition(state, next);
      return state;
    },
    end: (params) => {
      const next = markRealtimeVoiceSessionLeft(state, {
        reasonCode: params?.reasonCode ?? "left_by_user",
      });
      state = applyTransition(state, next);
      return state;
    },
    runWeakNetworkReplay: (params) => {
      root.obscurM6VoiceReplay?.start({
        roomId: params?.roomId ?? "m6-voice-room",
        mode: params?.mode ?? "join",
        supported: true,
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
      return state;
    },
  };
};
