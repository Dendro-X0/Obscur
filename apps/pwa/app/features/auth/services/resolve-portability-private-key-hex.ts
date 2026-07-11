import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { NATIVE_KEY_SENTINEL } from "@/app/features/crypto/crypto-service";
import { resolveActivePrivateKeyHex } from "./resolve-active-private-key-hex";

/** Resolves the active account key for portable import/export, including native secure-session storage. */
export const resolvePortabilityPrivateKeyHex = async (params: Readonly<{
  publicKeyHex: PublicKeyHex | null;
  privateKeyHex?: PrivateKeyHex | null;
}>): Promise<PrivateKeyHex | null> => {
  if (!params.publicKeyHex) {
    return null;
  }
  const sessionPrivateKeyHex = (
    params.privateKeyHex && params.privateKeyHex !== NATIVE_KEY_SENTINEL
      ? params.privateKeyHex
      : undefined
  );
  try {
    return await resolveActivePrivateKeyHex({
      privateKeyHex: sessionPrivateKeyHex ?? (params.privateKeyHex === NATIVE_KEY_SENTINEL ? NATIVE_KEY_SENTINEL : undefined),
      expectedPublicKeyHex: params.publicKeyHex,
    });
  } catch {
    return null;
  }
};
