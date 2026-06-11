/** SEC-B2 spam-shape thresholds — align with greenfield signal catalog v1. */
export const MSG_RATE_WINDOW_MS = 60_000;
export const MSG_RATE_THRESHOLD = 10;

export const INVITE_FANOUT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const INVITE_FANOUT_THRESHOLD = 20;

export const countTimestampsInWindow = (
  timestampsUnixMs: ReadonlyArray<number>,
  nowUnixMs: number,
  windowMs: number,
): number => {
  const windowStart = nowUnixMs - windowMs;
  return timestampsUnixMs.filter((value) => value >= windowStart).length;
};

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
