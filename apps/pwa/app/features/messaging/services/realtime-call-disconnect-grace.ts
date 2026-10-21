/**
 * R2 — brief WebRTC `disconnected` is a grace window, not an immediate hangup.
 * `failed` still ends the call. ICE restart is out of scope.
 */

export const REALTIME_CALL_DISCONNECT_GRACE_MS = 4_000;

export type RealtimeCallConnectionStateAction =
  | "ignore"
  | "start_grace"
  | "cancel_grace"
  | "end_interrupted";

export const resolveRealtimeCallConnectionStateAction = (params: Readonly<{
  connectionState: RTCPeerConnectionState;
  gracePending: boolean;
}>): RealtimeCallConnectionStateAction => {
  if (params.connectionState === "failed") {
    return "end_interrupted";
  }
  if (params.connectionState === "disconnected") {
    return params.gracePending ? "ignore" : "start_grace";
  }
  if (
    params.gracePending
    && (params.connectionState === "connected" || params.connectionState === "connecting")
  ) {
    return "cancel_grace";
  }
  return "ignore";
};

export const shouldEndCallAfterDisconnectGrace = (
  connectionState: RTCPeerConnectionState,
): boolean => (
  connectionState === "disconnected" || connectionState === "failed"
);
