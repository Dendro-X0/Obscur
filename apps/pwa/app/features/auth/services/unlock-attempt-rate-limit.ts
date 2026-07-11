export type UnlockAttemptState = Readonly<{
  consecutiveFailures: number;
  lastFailureAtMs: number;
  lockedUntilMs: number;
}>;

export type UnlockRateLimitGate = Readonly<{
  allowed: boolean;
  retryAfterMs: number;
  state: UnlockAttemptState;
}>;

export class UnlockRateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super("UNLOCK_RATE_LIMITED");
    this.name = "UnlockRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

const STORAGE_PREFIX = "obscur.unlock-attempts::";
const BACKOFF_START_FAILURE = 3;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 300_000;

const emptyState = (): UnlockAttemptState => ({
  consecutiveFailures: 0,
  lastFailureAtMs: 0,
  lockedUntilMs: 0,
});

const storageKey = (profileId: string): string => `${STORAGE_PREFIX}${profileId.trim() || "default"}`;

const readState = (profileId: string): UnlockAttemptState => {
  if (typeof sessionStorage === "undefined") {
    return emptyState();
  }
  const raw = sessionStorage.getItem(storageKey(profileId));
  if (!raw) {
    return emptyState();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UnlockAttemptState>;
    return {
      consecutiveFailures: typeof parsed.consecutiveFailures === "number" ? parsed.consecutiveFailures : 0,
      lastFailureAtMs: typeof parsed.lastFailureAtMs === "number" ? parsed.lastFailureAtMs : 0,
      lockedUntilMs: typeof parsed.lockedUntilMs === "number" ? parsed.lockedUntilMs : 0,
    };
  } catch {
    return emptyState();
  }
};

const writeState = (profileId: string, state: UnlockAttemptState): void => {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(storageKey(profileId), JSON.stringify(state));
};

export const computeUnlockBackoffMs = (consecutiveFailures: number): number => {
  if (consecutiveFailures < BACKOFF_START_FAILURE) {
    return 0;
  }
  const exponent = consecutiveFailures - BACKOFF_START_FAILURE;
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** exponent));
};

export const checkUnlockRateLimit = (
  profileId: string,
  nowMs: number = Date.now(),
): UnlockRateLimitGate => {
  const state = readState(profileId);
  if (state.lockedUntilMs > nowMs) {
    return {
      allowed: false,
      retryAfterMs: state.lockedUntilMs - nowMs,
      state,
    };
  }
  return {
    allowed: true,
    retryAfterMs: 0,
    state,
  };
};

export const recordUnlockFailure = (
  profileId: string,
  nowMs: number = Date.now(),
): UnlockAttemptState => {
  const prior = readState(profileId);
  const consecutiveFailures = prior.consecutiveFailures + 1;
  const backoffMs = computeUnlockBackoffMs(consecutiveFailures);
  const next: UnlockAttemptState = {
    consecutiveFailures,
    lastFailureAtMs: nowMs,
    lockedUntilMs: backoffMs > 0 ? nowMs + backoffMs : 0,
  };
  writeState(profileId, next);
  return next;
};

export const clearUnlockRateLimit = (profileId: string): void => {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.removeItem(storageKey(profileId));
};

export const assertUnlockRateLimit = (profileId: string, nowMs: number = Date.now()): void => {
  const gate = checkUnlockRateLimit(profileId, nowMs);
  if (!gate.allowed) {
    throw new UnlockRateLimitError(gate.retryAfterMs);
  }
};

export const __resetUnlockRateLimitForTests = (): void => {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  const keysToRemove: string[] = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
};
