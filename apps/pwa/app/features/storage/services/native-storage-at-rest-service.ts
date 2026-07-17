import type { Passphrase } from "@dweb/crypto/passphrase";
import { fromBase64 } from "@dweb/crypto/from-base64";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { resolveIdentityScopeProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";
import { profileDataKeyMaterialToBase64 } from "./profile-data-key";
import {
  clearProfileStorageKeySession,
  establishProfileStorageKeySession,
  establishProfileStorageKeySessionFromMaterial,
  getProfileStorageKeyMaterial,
} from "./profile-storage-key-session";
import { isVaultWriteEncryptionReady } from "./vault-at-rest";

const resolveStorageProfileId = (profileId?: string): string => {
  const explicit = profileId?.trim();
  if (explicit) {
    return explicit;
  }
  return hasNativeRuntime() ? resolveIdentityScopeProfileId() : getResolvedProfileId();
};

/** R5: vault catalog SQLite / layout migrations retired — LES owns catalog. */
const scheduleVaultUnlockMaintenance = async (): Promise<void> => {
  // Intentionally no-op. Message-local cache may still hydrate separately.
};

export const activateNativeStorageAtRestUnlock = async (params: Readonly<{
  profileId?: string;
  passphrase: Passphrase;
}>): Promise<void> => {
  const profileId = resolveStorageProfileId(params.profileId);
  if (!profileId) {
    return;
  }
  await establishProfileStorageKeySession({
    profileId,
    passphrase: params.passphrase,
  });
  if (!hasNativeRuntime()) {
    return;
  }
  const keyMaterial = getProfileStorageKeyMaterial(profileId);
  if (!keyMaterial) {
    return;
  }
  await invokeNativeCommand("desktop_storage_at_rest_unlock", {
    profileId,
    keyMaterialB64: profileDataKeyMaterialToBase64(keyMaterial),
  });
  await scheduleVaultUnlockMaintenance();
};

/** Restore vault encryption from OS keychain after stay-signed-in identity unlock. */
export const restoreNativeVaultEncryptionSessionIfNeeded = async (
  params?: Readonly<{ profileId?: string }>,
): Promise<boolean> => {
  if (!hasNativeRuntime()) {
    return false;
  }
  const profileId = resolveStorageProfileId(params?.profileId);
  if (!profileId) {
    return false;
  }
  if (isVaultWriteEncryptionReady(profileId)) {
    return true;
  }

  const restoreResult = await invokeNativeCommand<string | null>(
    "desktop_storage_at_rest_restore_keychain",
    { profileId },
    { timeoutMs: 8_000 },
  );
  if (restoreResult.ok && typeof restoreResult.value === "string" && restoreResult.value.trim()) {
    const keyMaterial = fromBase64(restoreResult.value.trim());
    if (keyMaterial.byteLength === 32) {
      establishProfileStorageKeySessionFromMaterial({ profileId, writeKeyMaterial: keyMaterial });
      await scheduleVaultUnlockMaintenance();
      return isVaultWriteEncryptionReady(profileId);
    }
  }

  try {
    const { readAuthAssistantVaultPayload } = await import(
      "@/app/features/auth-kernel/services/auth-assistant-vault-service"
    );
    const assistantPayload = await readAuthAssistantVaultPayload(profileId);
    if (assistantPayload?.passphrase?.trim()) {
      await activateNativeStorageAtRestUnlock({
        profileId,
        passphrase: assistantPayload.passphrase,
      });
      return isVaultWriteEncryptionReady(profileId);
    }
  } catch {
    // Best-effort fallback when login assist is unavailable.
  }

  return false;
};

/** Passphrase unlock establishes keys; keychain unlock restores persisted profile data key. */
export const syncNativeVaultEncryptionSessionAfterIdentityUnlock = async (
  params?: Readonly<{ profileId?: string; passphrase?: Passphrase }>,
): Promise<void> => {
  if (!hasNativeRuntime()) {
    return;
  }
  const profileId = resolveStorageProfileId(params?.profileId);
  if (params?.passphrase?.trim()) {
    await activateNativeStorageAtRestUnlock({
      profileId,
      passphrase: params.passphrase,
    });
    return;
  }
  await restoreNativeVaultEncryptionSessionIfNeeded({ profileId });
};

export const finalizeNativeStorageAtRestLock = async (params?: Readonly<{ profileId?: string }>): Promise<void> => {
  const profileId = resolveStorageProfileId(params?.profileId);
  if (hasNativeRuntime() && profileId) {
    await invokeNativeCommand("desktop_storage_at_rest_lock", { profileId });
  }
  clearProfileStorageKeySession(profileId || undefined);
  const { resetVaultMediaIndexCache } = await import("@/app/features/vault/services/local-media-store");
  resetVaultMediaIndexCache();
};
