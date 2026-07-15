/** SEC-B2 spam-shape thresholds — align with greenfield signal catalog v1. */
export const MSG_RATE_WINDOW_MS = 120_000;
export const MSG_RATE_THRESHOLD = 18;

/** Established contacts need a much higher burst before rate-only warnings fire. */
export const ACCEPTED_PEER_MSG_RATE_FLOOD_MULTIPLIER = 2.5;

export const INVITE_FANOUT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const INVITE_FANOUT_THRESHOLD = 20;

export type MsgRateSignalContext = Readonly<{
  peerIncomingCountLastMinute: number;
  msgRateThreshold: number;
  isContactCold: boolean;
  isPeerAccepted: boolean;
}>;

export const countTimestampsInWindow = (
  timestampsUnixMs: ReadonlyArray<number>,
  nowUnixMs: number,
  windowMs: number,
): number => {
  const windowStart = nowUnixMs - windowMs;
  return timestampsUnixMs.filter((value) => value >= windowStart).length;
};

export const resolveMsgRateThreshold = (params: MsgRateSignalContext): number => {
  if (params.isPeerAccepted && !params.isContactCold) {
    return Math.ceil(params.msgRateThreshold * ACCEPTED_PEER_MSG_RATE_FLOOD_MULTIPLIER);
  }
  return params.msgRateThreshold;
};

/** Rate signal — cold contacts at base threshold; accepted peers only at flood tier. */
export const shouldTriggerMsgRateSignal = (params: MsgRateSignalContext): boolean => (
  params.peerIncomingCountLastMinute > resolveMsgRateThreshold(params)
);

/** Legacy helper — base cold-contact threshold only (tests / dev-lab). */
export const detectMsgRateSignal = (peerIncomingCountLastMinute: number): boolean => (
  peerIncomingCountLastMinute > MSG_RATE_THRESHOLD
);

export const detectInviteFanoutSignal = (peerConnectionRequestCountLastDay: number): boolean => (
  peerConnectionRequestCountLastDay > INVITE_FANOUT_THRESHOLD
);

export const countPeerIncomingInWindow = (
  incomingTimestampsUnixMs: ReadonlyArray<number>,
  nowUnixMs: number,
  windowMs: number = MSG_RATE_WINDOW_MS,
): number => countTimestampsInWindow(incomingTimestampsUnixMs, nowUnixMs, windowMs);
