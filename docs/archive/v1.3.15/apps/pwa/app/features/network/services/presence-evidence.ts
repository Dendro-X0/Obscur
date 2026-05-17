import { PRESENCE_STALE_AFTER_MS } from "./realtime-presence";

const MAX_FUTURE_CLOCK_SKEW_MS = 5_000;

export const isRecentPresenceEvidenceActive = (params: Readonly<{
  lastObservedAtMs?: number;
  nowMs: number | null | undefined;
  staleAfterMs?: number;
}>): boolean => {
  if (typeof params.nowMs !== "number" || !Number.isFinite(params.nowMs)) {
    return false;
  }
  if (typeof params.lastObservedAtMs !== "number" || !Number.isFinite(params.lastObservedAtMs)) {
    return false;
  }
  if (params.lastObservedAtMs <= 0) {
    return false;
  }

  const staleAfterMs = params.staleAfterMs ?? PRESENCE_STALE_AFTER_MS;
  const deltaMs = params.nowMs - params.lastObservedAtMs;
  if (deltaMs < 0) {
    return Math.abs(deltaMs) <= MAX_FUTURE_CLOCK_SKEW_MS;
  }
  return deltaMs <= staleAfterMs;
};

export const presenceEvidenceInternals = {
  MAX_FUTURE_CLOCK_SKEW_MS,
};

