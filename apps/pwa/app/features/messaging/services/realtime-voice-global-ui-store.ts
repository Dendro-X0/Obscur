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
}>;

type Listener = () => void;

const listeners = new Set<Listener>();

let snapshot: GlobalVoiceCallOverlayState = {
  status: null,
  peerDisplayName: "Unknown caller",
  peerAvatarUrl: "",
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

export const setGlobalVoiceCallOverlayState = (next: GlobalVoiceCallOverlayState): void => {
  const unchanged = (
    snapshot.status === next.status
    && snapshot.peerDisplayName === next.peerDisplayName
    && snapshot.peerAvatarUrl === next.peerAvatarUrl
  );
  if (unchanged) {
    return;
  }
  snapshot = next;
  notify();
};

export const clearGlobalVoiceCallOverlayState = (): void => {
  setGlobalVoiceCallOverlayState({
    status: null,
    peerDisplayName: "Unknown caller",
    peerAvatarUrl: "",
  });
};

export const useGlobalVoiceCallOverlayState = (): GlobalVoiceCallOverlayState => (
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
);

