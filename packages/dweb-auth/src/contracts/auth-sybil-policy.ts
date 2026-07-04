/** Greenfield sybil ladder tiers — Plane B registration policy. */
export type AuthSybilTier = "A" | "B" | "C" | "D";

export type AuthRegistrationMode =
  | "standard"
  | "pow_medium"
  | "pow_hard"
  | "invite_required";

export type AuthSybilPolicySnapshot = Readonly<{
  tier: AuthSybilTier;
  registrationMode: AuthRegistrationMode;
  coldContactRequiresInvite: boolean;
  powDifficultyLabel?: string;
}>;

export const DEFAULT_AUTH_SYBIL_POLICY: AuthSybilPolicySnapshot = {
  tier: "B",
  registrationMode: "standard",
  coldContactRequiresInvite: true,
};
