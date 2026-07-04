import type { AuthSybilPolicySnapshot } from "../contracts/auth-sybil-policy";
import type { AuthResult } from "../contracts/auth-result";

export type EvaluateRegistrationParams = Readonly<{
  profileId: string;
  registrationMode: AuthSybilPolicySnapshot["registrationMode"];
}>;

export type RegistrationEvaluation = Readonly<{
  allowed: boolean;
  policy: AuthSybilPolicySnapshot;
  powRequired: boolean;
  inviteRequired: boolean;
}>;

/** Plane B — registration friction and sybil policy (no IdP). */
export type RegistrationPolicyPort = Readonly<{
  resolvePolicy: (profileId: string) => Promise<AuthResult<AuthSybilPolicySnapshot>>;
  evaluateRegistration: (params: EvaluateRegistrationParams) => Promise<AuthResult<RegistrationEvaluation>>;
}>;

export const REGISTRATION_POLICY_PORT_ID = "obscur.auth.registration-policy" as const;
