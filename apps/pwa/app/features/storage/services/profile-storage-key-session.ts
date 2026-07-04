import type { Passphrase } from "@dweb/crypto/passphrase";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { deriveProfileDataKeyMaterial } from "./profile-data-key";

const sessions = new Map<string, Uint8Array>();

const zeroizeKeyMaterial = (keyMaterial: Uint8Array): void => {
  keyMaterial.fill(0);
};

export const establishProfileStorageKeySession = async (params: Readonly<{
  profileId?: string;
  passphrase: Passphrase;
}>): Promise<void> => {
  if (!hasNativeRuntime()) {
    return;
  }
  const profileId = (params.profileId ?? getResolvedProfileId()).trim();
  if (!profileId) {
    return;
  }
  const existing = sessions.get(profileId);
  if (existing) {
    zeroizeKeyMaterial(existing);
  }
  const keyMaterial = await deriveProfileDataKeyMaterial({
    passphrase: params.passphrase,
    profileId,
  });
  sessions.set(profileId, keyMaterial);
};

export const getProfileStorageKeyMaterial = (profileId?: string): Uint8Array | null => {
  const resolved = (profileId ?? getResolvedProfileId()).trim();
  if (!resolved) {
    return null;
  }
  const keyMaterial = sessions.get(resolved);
  return keyMaterial ? new Uint8Array(keyMaterial) : null;
};

export const clearProfileStorageKeySession = (profileId?: string): void => {
  if (profileId?.trim()) {
    const existing = sessions.get(profileId.trim());
    if (existing) {
      zeroizeKeyMaterial(existing);
      sessions.delete(profileId.trim());
    }
    return;
  }
  sessions.forEach((keyMaterial) => zeroizeKeyMaterial(keyMaterial));
  sessions.clear();
};

export const __resetProfileStorageKeySessionsForTests = (): void => {
  clearProfileStorageKeySession();
};
