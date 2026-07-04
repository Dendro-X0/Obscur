import type { PoWDifficulty } from "@/app/features/auth/services/pow-key-generator";
import type { RegistrationEvaluation } from "@dweb/auth";
import { createAuthKernelRegistrationPolicyPort } from "./auth-kernel-registration-policy-adapter";
import { resolveAuthKernelSybilPolicy } from "./auth-kernel-sybil-policy-config";
import {
  checkAuthKernelRegistrationThrottle,
  recordAuthKernelRegistrationAttempt,
  resolveAuthKernelRegistrationThrottleBudget,
} from "./auth-kernel-registration-throttle";

const mapPowDifficulty = (evaluation: RegistrationEvaluation): PoWDifficulty => {
  if (evaluation.policy.registrationMode === "pow_hard") {
    return "hard";
  }
  if (evaluation.policy.powDifficultyLabel === "hard") {
    return "hard";
  }
  return "medium";
};

export type AuthKernelRegistrationGateResult = Readonly<{
  evaluation: RegistrationEvaluation;
  powDifficulty: PoWDifficulty | null;
  throttled: boolean;
  retryAfterMs: number;
}>;

/** Plane B gate — single owner for create-path registration friction. */
export const evaluateAuthKernelRegistrationGate = async (
  profileId: string,
): Promise<AuthKernelRegistrationGateResult> => {
  const port = createAuthKernelRegistrationPolicyPort();
  const policy = resolveAuthKernelSybilPolicy(profileId.trim());
  const result = await port.evaluateRegistration({
    profileId,
    registrationMode: policy.registrationMode,
  });
  if (result.status === "failed" || !result.value) {
    throw new Error(result.message ?? "Registration policy evaluation failed");
  }
  const evaluation = result.value;
  const powDifficulty = evaluation.powRequired ? mapPowDifficulty(evaluation) : null;
  const throttleBudget = resolveAuthKernelRegistrationThrottleBudget(evaluation);
  if (throttleBudget) {
    const throttle = checkAuthKernelRegistrationThrottle(profileId.trim(), throttleBudget);
    if (throttle.throttled) {
      return {
        evaluation,
        powDifficulty,
        throttled: true,
        retryAfterMs: throttle.retryAfterMs,
      };
    }
    recordAuthKernelRegistrationAttempt(profileId.trim(), throttleBudget);
  }
  return {
    evaluation,
    powDifficulty,
    throttled: false,
    retryAfterMs: 0,
  };
};
