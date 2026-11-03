import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { isIdentityPassphrasePolicyCompliant } from "@/app/features/security/services/identity-passphrase-policy";
import {
  activateNativeStorageAtRestUnlock,
  ensureNativeSqliteOpenForWrites,
} from "@/app/features/storage/services/native-storage-at-rest-service";

export type CompleteDevicePasswordBindAfterKeyParams = Readonly<{
  profileId: string;
  passphrase: Passphrase;
  privateKeyHex?: PrivateKeyHex;
  resetPassphraseWithPrivateKey?: (params: Readonly<{
    privateKeyHex: PrivateKeyHex;
    newPassphrase: Passphrase;
  }>) => Promise<void>;
}>;

export type CompleteDevicePasswordBindAfterKeyResult = Readonly<{
  ok: boolean;
  reason?: "policy" | "activate_failed" | "sqlite_closed" | "error";
  message?: string;
}>;

/**
 * Slice A — after Advanced key unlock left native PDK closed, bind device password
 * so chat storage opens. Caller clears bind-pending + shows Welcome Back on ok.
 */
export const completeDevicePasswordBindAfterKey = async (
  params: CompleteDevicePasswordBindAfterKeyParams,
): Promise<CompleteDevicePasswordBindAfterKeyResult> => {
  if (!isIdentityPassphrasePolicyCompliant(params.passphrase)) {
    return { ok: false, reason: "policy" };
  }
  try {
    const activated = await activateNativeStorageAtRestUnlock({
      profileId: params.profileId,
      passphrase: params.passphrase,
    });
    if (!activated) {
      return { ok: false, reason: "activate_failed" };
    }
    if (params.privateKeyHex && params.resetPassphraseWithPrivateKey) {
      try {
        await params.resetPassphraseWithPrivateKey({
          privateKeyHex: params.privateKeyHex,
          newPassphrase: params.passphrase,
        });
      } catch {
        // Re-wrap is best-effort; PDK open is the gate for chat.
      }
    }
    const storageOpen = await ensureNativeSqliteOpenForWrites({
      profileId: params.profileId,
    });
    if (!storageOpen) {
      return { ok: false, reason: "sqlite_closed" };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
};
