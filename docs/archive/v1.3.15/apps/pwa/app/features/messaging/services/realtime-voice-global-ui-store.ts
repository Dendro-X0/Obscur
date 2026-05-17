import { useSyncExternalStore } from "react";

export type GlobalVoiceCallOverlayStatus = Readonly<{
  roomId: string;
  peerPubkey: string;
  phase: "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended";
  role: "host" | "joiner";
  sinceUnixMs: number;
  reasonCode?: "left_by_user" | "remote_left" | "network_interrupted" | "session_closed";
}>;

export type GlobalVoiceCallOverlayState = Readonly<{
  status: GlobalVoiceCallOverlayStatus | null;
  peerDisplayName: string;
  peerAvatarUrl: string;
  waveAudioLevel: number;
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
  Omit<GlobalVoiceCallOverlayState, "waveAudioLevel">
  & { waveAudioLevel?: number }
>): void => {
  const normalizedWaveAudioLevel = normalizeWaveAudioLevel(
    next.waveAudioLevel ?? snapshot.waveAudioLevel,
  );
  const unchanged = (
    snapshot.status === next.status
    && snapshot.peerDisplayName === next.peerDisplayName
    && snapshot.peerAvatarUrl === next.peerAvatarUrl
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
  });
};

export const useGlobalVoiceCallOverlayState = (): GlobalVoiceCallOverlayState => (
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
);

export const realtimeVoiceGlobalUiStoreInternals = {
  normalizeWaveAudioLevel,
};
