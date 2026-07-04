import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import type { RegistrationEvaluation } from "@dweb/auth";

const REGISTRATION_ATTEMPTS_KEY = "auth.kernel.registration_attempts";

export const AUTH_KERNEL_REGISTRATION_THROTTLE_WINDOW_MS = 15 * 60 * 1000;

export type AuthKernelRegistrationThrottleBudget = Readonly<{
  maxAttempts: number;
  windowMs: number;
}>;

export type AuthKernelRegistrationThrottleResult = Readonly<{
  throttled: boolean;
  retryAfterMs: number;
  attemptCount: number;
}>;

const readAttemptTimestamps = (profileId: string): number[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = sessionStorage.getItem(getScopedStorageKey(REGISTRATION_ATTEMPTS_KEY, profileId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is number => typeof entry === "number");
  } catch {
    return [];
  }
};

const writeAttemptTimestamps = (profileId: string, attempts: ReadonlyArray<number>): void => {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(
    getScopedStorageKey(REGISTRATION_ATTEMPTS_KEY, profileId),
    JSON.stringify(attempts),
  );
};

const pruneAttempts = (
  attempts: ReadonlyArray<number>,
  windowMs: number,
  nowMs: number,
): number[] => (
  attempts.filter((timestamp) => nowMs - timestamp < windowMs)
);

/** Plane B anti-farm budget — active when PoW create is required (AUTH-KERN-5). */
export const resolveAuthKernelRegistrationThrottleBudget = (
  evaluation: RegistrationEvaluation,
): AuthKernelRegistrationThrottleBudget | null => {
  if (!evaluation.powRequired) {
    return null;
  }
  if (evaluation.policy.registrationMode === "pow_hard") {
    return { maxAttempts: 3, windowMs: AUTH_KERNEL_REGISTRATION_THROTTLE_WINDOW_MS };
  }
  return { maxAttempts: 5, windowMs: AUTH_KERNEL_REGISTRATION_THROTTLE_WINDOW_MS };
};

export const checkAuthKernelRegistrationThrottle = (
  profileId: string,
  budget: AuthKernelRegistrationThrottleBudget,
  nowMs = Date.now(),
): AuthKernelRegistrationThrottleResult => {
  const attempts = pruneAttempts(readAttemptTimestamps(profileId), budget.windowMs, nowMs);
  if (attempts.length >= budget.maxAttempts) {
    const oldest = attempts[0] ?? nowMs;
    return {
      throttled: true,
      retryAfterMs: Math.max(0, budget.windowMs - (nowMs - oldest)),
      attemptCount: attempts.length,
    };
  }
  return {
    throttled: false,
    retryAfterMs: 0,
    attemptCount: attempts.length,
  };
};

export const recordAuthKernelRegistrationAttempt = (
  profileId: string,
  budget: AuthKernelRegistrationThrottleBudget,
  nowMs = Date.now(),
): void => {
  const attempts = [
    ...pruneAttempts(readAttemptTimestamps(profileId), budget.windowMs, nowMs),
    nowMs,
  ];
  writeAttemptTimestamps(profileId, attempts);
};

export const resetAuthKernelRegistrationThrottleForTests = (profileId?: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  if (profileId) {
    sessionStorage.removeItem(getScopedStorageKey(REGISTRATION_ATTEMPTS_KEY, profileId));
    return;
  }
  sessionStorage.clear();
};
