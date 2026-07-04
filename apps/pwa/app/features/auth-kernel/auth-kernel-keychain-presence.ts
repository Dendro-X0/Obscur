import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { createAuthKernelRuntimeSessionPort } from "./auth-kernel-runtime-session-adapter";

export const readAuthKernelKeychainPresent = async (params: Readonly<{
  profileId: string;
  expectedPublicKeyHex: PublicKeyHex;
}>): Promise<boolean> => {
  if (!hasNativeRuntime()) {
    return false;
  }
  const port = createAuthKernelRuntimeSessionPort();
  const result = await port.readBootSnapshot({
    profileId: params.profileId,
    expectedPublicKeyHex: params.expectedPublicKeyHex,
    restoreEligible: false,
  });
  if (result.status !== "ok") {
    return false;
  }
  return Boolean(result.value?.keychainPresent);
};
