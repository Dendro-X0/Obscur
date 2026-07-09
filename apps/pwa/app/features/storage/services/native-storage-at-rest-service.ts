import type { Passphrase } from "@dweb/crypto/passphrase";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { profileDataKeyMaterialToBase64 } from "./profile-data-key";
import {
  clearProfileStorageKeySession,
  establishProfileStorageKeySession,
  getProfileStorageKeyMaterial,
} from "./profile-storage-key-session";

export const activateNativeStorageAtRestUnlock = async (params: Readonly<{
  profileId?: string;
  passphrase: Passphrase;
}>): Promise<void> => {
  const profileId = (params.profileId ?? getResolvedProfileId()).trim();
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
  const { scheduleVaultUnlockMaintenance } = await import(
    "@/app/features/vault/services/vault-media-index-sqlite-migration"
  );
  scheduleVaultUnlockMaintenance();
};

export const finalizeNativeStorageAtRestLock = async (params?: Readonly<{ profileId?: string }>): Promise<void> => {
  const profileId = (params?.profileId ?? getResolvedProfileId()).trim();
  if (hasNativeRuntime() && profileId) {
    await invokeNativeCommand("desktop_storage_at_rest_lock", { profileId });
  }
  clearProfileStorageKeySession(profileId || undefined);
  const { resetVaultMediaIndexCache } = await import("@/app/features/vault/services/local-media-store");
  resetVaultMediaIndexCache();
};
