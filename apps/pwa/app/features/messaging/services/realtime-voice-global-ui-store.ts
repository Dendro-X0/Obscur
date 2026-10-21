import { useSyncExternalStore } from "react";

export type GlobalVoiceCallOverlayStatus = Readonly<{
  roomId: string;
  peerPubkey: string;
  phase: "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended";
  role: "host" | "joiner";
  sinceUnixMs: number;
  reasonCode?: "left_by_user" | "remote_left" | "network_interrupted" | "session_closed";
  /** M1-A: negotiated call type; omit = voice. */
  callType?: "voice" | "video";
  /** M1-B: local media outcome for honesty banner. */
  mediaMode?: "audio" | "av" | "audio_only_fallback" | "av_lab_canvas";
}>;

export type GlobalVoiceCallOverlayState = Readonly<{
  status: GlobalVoiceCallOverlayStatus | null;
  peerDisplayName: string;
  peerAvatarUrl: string;
  waveAudioLevel: number;
  /** Live preview tracks for video dock/stage (null when voice-only or not yet attached). */
  localVideoStream: MediaStream | null;
  remoteVideoStream: MediaStream | null;
}>;

type Listener = () => void;

const listeners = new Set<Listener>();

const normalizeWaveAudioLevel = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
};

let snapshot: GlobalVoiceCallOverlayState = {
  status: null,
  peerDisplayName: "Unknown caller",
  peerAvatarUrl: "",
  waveAudioLevel: 0,
  localVideoStream: null,
  remoteVideoStream: null,
};

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): GlobalVoiceCallOverlayState => snapshot;

export const setGlobalVoiceCallOverlayState = (next: Readonly<
  Omit<GlobalVoiceCallOverlayState, "waveAudioLevel" | "localVideoStream" | "remoteVideoStream">
  & {
    waveAudioLevel?: number;
    localVideoStream?: MediaStream | null;
    remoteVideoStream?: MediaStream | null;
  }
>): void => {
  const normalizedWaveAudioLevel = normalizeWaveAudioLevel(
    next.waveAudioLevel ?? snapshot.waveAudioLevel,
  );
  const localVideoStream = next.localVideoStream !== undefined
    ? next.localVideoStream
    : snapshot.localVideoStream;
  const remoteVideoStream = next.remoteVideoStream !== undefined
    ? next.remoteVideoStream
    : snapshot.remoteVideoStream;
  const unchanged = (
    snapshot.status === next.status
    && snapshot.peerDisplayName === next.peerDisplayName
    && snapshot.peerAvatarUrl === next.peerAvatarUrl
    && snapshot.localVideoStream === localVideoStream
    && snapshot.remoteVideoStream === remoteVideoStream
    && Math.abs(snapshot.waveAudioLevel - normalizedWaveAudioLevel) < 0.005
  );
  if (unchanged) {
    return;
  }
  snapshot = {
    status: next.status,
    peerDisplayName: next.peerDisplayName,
    peerAvatarUrl: next.peerAvatarUrl,
    waveAudioLevel: normalizedWaveAudioLevel,
    localVideoStream,
    remoteVideoStream,
  };
  notify();
};

export const setGlobalVoiceCallOverlayWaveAudioLevel = (nextWaveAudioLevel: number): void => {
  const normalizedWaveAudioLevel = normalizeWaveAudioLevel(nextWaveAudioLevel);
  if (Math.abs(snapshot.waveAudioLevel - normalizedWaveAudioLevel) < 0.002) {
    return;
  }
  snapshot = {
    ...snapshot,
    waveAudioLevel: normalizedWaveAudioLevel,
  };
  notify();
};

export const clearGlobalVoiceCallOverlayState = (): void => {
  setGlobalVoiceCallOverlayState({
    status: null,
    peerDisplayName: "Unknown caller",
    peerAvatarUrl: "",
    waveAudioLevel: 0,
    localVideoStream: null,
    remoteVideoStream: null,
  });
};

export const useGlobalVoiceCallOverlayState = (): GlobalVoiceCallOverlayState => (
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
);

export const realtimeVoiceGlobalUiStoreInternals = {
  normalizeWaveAudioLevel,
};
