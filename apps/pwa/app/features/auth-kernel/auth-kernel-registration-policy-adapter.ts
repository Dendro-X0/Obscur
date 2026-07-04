import type { RegistrationPolicyPort } from "@dweb/auth";
import { authFailed, authOk, evaluateAuthRegistrationPolicy } from "@dweb/auth";
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
