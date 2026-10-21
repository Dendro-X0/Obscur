/**
 * Single-session busy-line: one active 1:1 at a time.
 * Third-party invites must not clobber an in-progress call UI/RTC.
 */

export type VoiceCallBusyPhase =
  | "ringing_outgoing"
  | "ringing_incoming"
  | "connecting"
  | "connected"
  | "interrupted"
  | "ended";

export const isVoiceCallLineBusy = (
  phase: VoiceCallBusyPhase | null | undefined,
): boolean => (
  phase === "ringing_outgoing"
  || phase === "ringing_incoming"
  || phase === "connecting"
  || phase === "connected"
);

/**
 * Defer invite ingest while any call is on the line (same or third-party peer).
 * Same-peer re-invites and C→A during A↔B both wait until idle.
 */
export const shouldDeferVoiceInviteForBusyLine = (params: Readonly<{
  phase: VoiceCallBusyPhase | null | undefined;
  rtcConnectionState?: string | null;
}>): boolean => {
  if (isVoiceCallLineBusy(params.phase)) {
    return true;
  }
  const rtc = params.rtcConnectionState ?? "none";
  return rtc === "new" || rtc === "connecting" || rtc === "connected";
};

/** Outbound dial preflight — do not start a second invite while the line is busy. */
export const canStartVoiceCallInviteWhileLineIdle = (params: Readonly<{
  phase: VoiceCallBusyPhase | null | undefined;
}>): boolean => !isVoiceCallLineBusy(params.phase);
