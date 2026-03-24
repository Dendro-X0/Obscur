import type { RealtimeVoiceUnsupportedReasonCode } from "@/app/features/messaging/services/realtime-voice-capability";
import {
  createInitialRealtimeVoiceSessionState,
  type RealtimeVoiceSessionMode,
  type RealtimeVoiceSessionState,
} from "@/app/features/messaging/services/realtime-voice-session-lifecycle";
import { createRealtimeVoiceSessionOwner } from "@/app/features/messaging/services/realtime-voice-session-owner";

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
      return syncFromOwner();
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
