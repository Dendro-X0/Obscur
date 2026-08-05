import type { RegistrationPolicyPort } from "@dweb/auth/ports/registration-policy-port";
import { authFailed, authOk } from "@dweb/auth/contracts/auth-result";
import { evaluateAuthRegistrationPolicy } from "@dweb/auth/policy/registration-policy-engine";
import { resolveAuthKernelSybilPolicy } from "./auth-kernel-sybil-policy-config";

export const createAuthKernelRegistrationPolicyPort = (): RegistrationPolicyPort => ({
  resolvePolicy: async (profileId) => {
    const trimmed = profileId.trim();
    if (!trimmed) {
      return authFailed({ reasonCode: "invalid_input", message: "profileId required" });
    }
    return authOk(resolveAuthKernelSybilPolicy(trimmed));
  },

  evaluateRegistration: async (params) => {
    const trimmed = params.profileId.trim();
    if (!trimmed) {
      return authFailed({ reasonCode: "invalid_input", message: "profileId required" });
    }
    const policy = resolveAuthKernelSybilPolicy(trimmed);
    return authOk(evaluateAuthRegistrationPolicy({
      policy,
      registrationMode: params.registrationMode,
    }));
  },
});
