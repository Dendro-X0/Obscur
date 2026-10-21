import type { Passphrase } from "@dweb/crypto/passphrase";
import { fromBase64 } from "@dweb/crypto/from-base64";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { profileDataKeyMaterialToBase64 } from "./profile-data-key";
import {
  clearProfileStorageKeySession,
  establishProfileStorageKeySession,
  establishProfileStorageKeySessionFromMaterial,
  getProfileStorageKeyMaterial,
} from "./profile-storage-key-session";
import { isVaultWriteEncryptionReady, resolveVaultProfileId } from "./vault-at-rest";

const resolveStorageProfileId = (profileId?: string): string => {
  const explicit = profileId?.trim();
  if (explicit) {
    return explicit;
  }
  return resolveVaultProfileId();
};

/** R5: vault catalog SQLite / layout migrations retired — LES owns catalog. */
const scheduleVaultUnlockMaintenance = async (): Promise<void> => {
  // Intentionally no-op. Message-local cache may still hydrate separately.
};

export const activateNativeStorageAtRestUnlock = async (params: Readonly<{
  profileId?: string;
  passphrase: Passphrase;
}>): Promise<boolean> => {
  const profileId = resolveStorageProfileId(params.profileId);
  if (!profileId) {
    return false;
  }
  await establishProfileStorageKeySession({
    profileId,
    passphrase: params.passphrase,
  });
  if (!hasNativeRuntime()) {
    return Boolean(getProfileStorageKeyMaterial(profileId));
  }
  const keyMaterial = getProfileStorageKeyMaterial(profileId);
  if (!keyMaterial) {
    return false;
  }
  const unlockResult = await invokeNativeCommand("desktop_storage_at_rest_unlock", {
    profileId,
    keyMaterialB64: profileDataKeyMaterialToBase64(keyMaterial),
  });
  if (!unlockResult.ok) {
    return false;
  }
  await scheduleVaultUnlockMaintenance();
  return true;
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
      const activated = await activateNativeStorageAtRestUnlock({
        profileId,
        passphrase: assistantPayload.passphrase,
      });
      return activated && isVaultWriteEncryptionReady(profileId);
    }
  } catch {
    // Best-effort fallback when login assist is unavailable.
  }

  return false;
};

/**
 * Ensure JS + native PDK are both present for LES / vault writes.
 * Stay-signed-in can leave chat unlocked while LES still lacks StorageAtRestState.
 */
export const ensureNativeVaultEncryptionSessionForWrites = async (
  params?: Readonly<{ profileId?: string }>,
): Promise<boolean> => {
  const profileId = resolveStorageProfileId(params?.profileId);
  if (!profileId) {
    return false;
  }

  if (!isVaultWriteEncryptionReady(profileId)) {
    const restored = await restoreNativeVaultEncryptionSessionIfNeeded({ profileId });
    if (!restored) {
      return false;
    }
  }

  if (!hasNativeRuntime()) {
    return isVaultWriteEncryptionReady(profileId);
  }

  const keyMaterial = getProfileStorageKeyMaterial(profileId);
  if (!keyMaterial || keyMaterial.byteLength !== 32) {
    return false;
  }

  const unlockResult = await invokeNativeCommand("desktop_storage_at_rest_unlock", {
    profileId,
    keyMaterialB64: profileDataKeyMaterialToBase64(keyMaterial),
  });
  if (!unlockResult.ok) {
    return false;
  }
  return true;
};

/**
 * Soft-lock drift: shell may look unlocked while DbState.db is None.
 * Prefer PDK unlock; otherwise reopen plaintext SQLite when no at-rest envelope.
 */
export const ensureNativeSqliteOpenForWrites = async (
  params?: Readonly<{ profileId?: string }>,
): Promise<boolean> => {
  if (!hasNativeRuntime()) {
    return true;
  }
  const vaultReady = await ensureNativeVaultEncryptionSessionForWrites(params);
  if (vaultReady) {
    return true;
  }
  const reopen = await invokeNativeCommand<boolean>("desktop_db_ensure_open", {}, { timeoutMs: 8_000 });
  return reopen.ok === true;
};

/** Passphrase unlock establishes keys; keychain unlock restores persisted profile data key. */
export const syncNativeVaultEncryptionSessionAfterIdentityUnlock = async (
  params?: Readonly<{ profileId?: string; passphrase?: Passphrase }>,
): Promise<boolean> => {
  if (!hasNativeRuntime()) {
    return true;
  }
  const profileId = resolveStorageProfileId(params?.profileId);
  if (params?.passphrase?.trim()) {
    return activateNativeStorageAtRestUnlock({
      profileId,
      passphrase: params.passphrase,
    });
  }
  return restoreNativeVaultEncryptionSessionIfNeeded({ profileId });
};

export { resolveSoftLockUnlockMode } from "./soft-lock-unlock-mode";
export type { SoftLockUnlockMode, SoftLockUnlockModeInput } from "./soft-lock-unlock-mode";

export const finalizeNativeStorageAtRestLock = async (params?: Readonly<{ profileId?: string }>): Promise<void> => {
  const profileId = resolveStorageProfileId(params?.profileId);
  if (hasNativeRuntime() && profileId) {
    await invokeNativeCommand("desktop_storage_at_rest_lock", { profileId });
  }
  clearProfileStorageKeySession(profileId || undefined);
  const { resetVaultMediaIndexCache } = await import("@/app/features/vault/services/local-media-store");
  resetVaultMediaIndexCache();
};
