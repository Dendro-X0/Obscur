import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { NATIVE_KEY_SENTINEL } from "@/app/features/crypto/crypto-service";
import { decodePrivateKey } from "@/app/features/auth/utils/decode-private-key";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";

export const resolveActivePrivateKeyHex = async (params: Readonly<{
  privateKeyHex?: PrivateKeyHex;
  expectedPublicKeyHex?: PublicKeyHex;
  setupPrivateKeyHex?: PrivateKeyHex;
}>): Promise<PrivateKeyHex> => {
  if (params.setupPrivateKeyHex) {
    const decodedSetup = decodePrivateKey(params.setupPrivateKeyHex);
    if (decodedSetup) {
      if (params.expectedPublicKeyHex && derivePublicKeyHex(decodedSetup) !== params.expectedPublicKeyHex) {
        throw new Error("Private key does not match stored identity.");
      }
      return decodedSetup;
    }
  }

  if (params.privateKeyHex && params.privateKeyHex !== NATIVE_KEY_SENTINEL) {
    const decoded = decodePrivateKey(params.privateKeyHex);
    if (!decoded) {
      throw new Error("Invalid private key format. Expected 64-character hex.");
    }
    if (params.expectedPublicKeyHex && derivePublicKeyHex(decoded) !== params.expectedPublicKeyHex) {
      throw new Error("Private key does not match stored identity.");
    }
    return decoded;
  }

  const nsecResult = await invokeNativeCommand<string>("get_session_nsec");
  if (!nsecResult.ok || !nsecResult.value) {
    throw new Error("Unlock session expired. Lock and import your key again.");
  }

  const decoded = decodePrivateKey(nsecResult.value);
  if (!decoded) {
    throw new Error("Failed to resolve private key from native session.");
  }
  if (params.expectedPublicKeyHex && derivePublicKeyHex(decoded) !== params.expectedPublicKeyHex) {
    throw new Error("Private key does not match stored identity.");
  }
  return decoded;
};
