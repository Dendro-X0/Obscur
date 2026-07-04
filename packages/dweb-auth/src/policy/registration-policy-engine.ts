import type { AuthRegistrationMode, AuthSybilPolicySnapshot, AuthSybilTier } from "../contracts/auth-sybil-policy";
import { DEFAULT_AUTH_SYBIL_POLICY } from "../contracts/auth-sybil-policy";
import type { RegistrationEvaluation } from "../ports/registration-policy-port";

export const AUTH_SYBIL_TIER_POLICIES: Readonly<Record<AuthSybilTier, AuthSybilPolicySnapshot>> = {
  A: {
    tier: "A",
    registrationMode: "standard",
    coldContactRequiresInvite: false,
  },
  B: DEFAULT_AUTH_SYBIL_POLICY,
  C: {
    tier: "C",
    registrationMode: "pow_medium",
    coldContactRequiresInvite: true,
    powDifficultyLabel: "medium",
  },
  D: {
    tier: "D",
    registrationMode: "invite_required",
    coldContactRequiresInvite: true,
  },
};

export const resolveAuthSybilPolicyForTier = (tier: AuthSybilTier): AuthSybilPolicySnapshot => (
  AUTH_SYBIL_TIER_POLICIES[tier] ?? DEFAULT_AUTH_SYBIL_POLICY
);

export const evaluateAuthRegistrationPolicy = (params: Readonly<{
  policy: AuthSybilPolicySnapshot;
  registrationMode?: AuthRegistrationMode;
}>): RegistrationEvaluation => {
  const registrationMode = params.registrationMode ?? params.policy.registrationMode;
  const policy: AuthSybilPolicySnapshot = {
    ...params.policy,
    registrationMode,
    powDifficultyLabel: registrationMode === "pow_hard"
      ? "hard"
      : registrationMode === "pow_medium"
        ? "medium"
        : params.policy.powDifficultyLabel,
  };
  const inviteRequired = registrationMode === "invite_required";
  const powRequired = registrationMode === "pow_medium" || registrationMode === "pow_hard";
  return {
    allowed: !inviteRequired,
    policy,
    powRequired,
    inviteRequired,
  };
};
