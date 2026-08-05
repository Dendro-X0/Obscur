import type { Passphrase } from "@dweb/crypto/passphrase";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { resolveIdentityScopeProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  deriveProfileDataKeyMaterial,
  deriveProfileDataKeyReadCandidates,
} from "./profile-data-key";

type ProfileStorageKeySession = Readonly<{
  writeKeyMaterial: Uint8Array;
  readKeyMaterials: ReadonlyArray<Uint8Array>;
}>;

const sessions = new Map<string, ProfileStorageKeySession>();

/** Same owner rule as resolveVaultProfileId — avoid circular import with vault-at-rest. */
const resolveSessionProfileId = (profileId?: string): string => {
  const explicit = profileId?.trim();
  if (explicit) {
    return explicit;
  }
  return hasNativeRuntime() ? resolveIdentityScopeProfileId() : getResolvedProfileId();
};

const zeroizeKeyMaterial = (keyMaterial: Uint8Array): void => {
  keyMaterial.fill(0);
};

const zeroizeSession = (session: ProfileStorageKeySession): void => {
  zeroizeKeyMaterial(session.writeKeyMaterial);
  session.readKeyMaterials.forEach((keyMaterial) => zeroizeKeyMaterial(keyMaterial));
};

export const establishProfileStorageKeySession = async (params: Readonly<{
  profileId?: string;
  passphrase: Passphrase;
}>): Promise<void> => {
  if (!hasNativeRuntime()) {
    return;
  }
  const profileId = resolveSessionProfileId(params.profileId);
  if (!profileId) {
    return;
  }
  const existing = sessions.get(profileId);
  if (existing) {
    zeroizeSession(existing);
  }
  const readKeyMaterials = await deriveProfileDataKeyReadCandidates({
    passphrase: params.passphrase,
    profileId,
  });
  const writeKeyMaterial = await deriveProfileDataKeyMaterial({
    passphrase: params.passphrase,
    profileId,
  });
  sessions.set(profileId, {
    writeKeyMaterial,
    readKeyMaterials,
  });
};

/** Hydrate in-memory vault encryption session from persisted key material (keychain restore). */
export const establishProfileStorageKeySessionFromMaterial = (params: Readonly<{
  profileId?: string;
  writeKeyMaterial: Uint8Array;
  readKeyMaterials?: ReadonlyArray<Uint8Array>;
}>): void => {
  if (!hasNativeRuntime()) {
    return;
  }
  const profileId = resolveSessionProfileId(params.profileId);
  if (!profileId || params.writeKeyMaterial.byteLength !== 32) {
    return;
  }
  const existing = sessions.get(profileId);
  if (existing) {
    zeroizeSession(existing);
  }
  const writeCopy = new Uint8Array(params.writeKeyMaterial);
  const readKeyMaterials = params.readKeyMaterials?.length
    ? params.readKeyMaterials.map((keyMaterial) => new Uint8Array(keyMaterial))
    : [writeCopy];
  sessions.set(profileId, {
    writeKeyMaterial: writeCopy,
    readKeyMaterials,
  });
};

export const getProfileStorageKeyMaterial = (profileId?: string): Uint8Array | null => {
  const resolved = resolveSessionProfileId(profileId);
  if (!resolved) {
    return null;
  }
  const session = sessions.get(resolved);
  return session ? new Uint8Array(session.writeKeyMaterial) : null;
};

export const getProfileStorageKeyReadCandidates = (profileId?: string): ReadonlyArray<Uint8Array> => {
  const resolved = resolveSessionProfileId(profileId);
  if (!resolved) {
    return [];
  }
  const session = sessions.get(resolved);
  if (!session) {
    return [];
  }
  return session.readKeyMaterials.map((keyMaterial) => new Uint8Array(keyMaterial));
};

export const clearProfileStorageKeySession = (profileId?: string): void => {
  if (profileId?.trim()) {
    const existing = sessions.get(profileId.trim());
    if (existing) {
      zeroizeSession(existing);
      sessions.delete(profileId.trim());
    }
    return;
  }
  sessions.forEach((session) => zeroizeSession(session));
  sessions.clear();
};

export const __resetProfileStorageKeySessionsForTests = (): void => {
  clearProfileStorageKeySession();
};
