/**
 * AUTH-K1 legacy bridge — single allowed import surface from scatter into auth-kernel adapters.
 * @see docs/program/obscur-auth-kernel-charter-2026-06.md
 */
import type { IdentityRecord } from "@dweb/core/identity-record";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AuthUnlockOptions } from "@dweb/auth";
import {
  authKernelIdentityActions,
  getIdentitySnapshot,
  useIdentityInternals,
} from "@/app/features/auth/hooks/use-identity";
import { clearDeviceTrustArtifacts } from "@/app/features/auth/services/device-trust-service";
import { endNativeDeviceSignInBestEffort } from "@/app/features/auth/services/native-device-session-lifecycle";
import { resolveStaySignedIn } from "@/app/features/auth/services/device-session-consent";
import { getStoredIdentity } from "@/app/features/auth/utils/get-stored-identity";
import { readIdentityRecordFromLocalStorage } from "@/app/features/auth/utils/identity-persistence";
import { resolveIdentityScopeProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";
import { resolveStoredIdentityRecord } from "@/app/features/profiles/services/data-root-identity-repair";

export type StoredIdentitySnapshot = Readonly<{
  profileId: string;
  record: IdentityRecord | null;
  publicKeyHex: PublicKeyHex | null;
}>;

export class AuthKernelProfileScopeError extends Error {
  constructor(expectedProfileId: string, requestedProfileId: string) {
    super(`Profile scope mismatch: active=${expectedProfileId}, requested=${requestedProfileId}`);
    this.name = "AuthKernelProfileScopeError";
  }
}

export const assertAuthKernelProfileScope = (profileId: string): void => {
  const activeProfileId = resolveIdentityScopeProfileId().trim();
  const requestedProfileId = profileId.trim();
  if (!requestedProfileId || activeProfileId !== requestedProfileId) {
    throw new AuthKernelProfileScopeError(activeProfileId, requestedProfileId);
  }
};

export const readStoredIdentitySnapshot = async (
  profileId: string,
): Promise<StoredIdentitySnapshot> => {
  assertAuthKernelProfileScope(profileId);
  const durable = await resolveStoredIdentityRecord({ profileId });
  if (durable) {
    return {
      profileId,
      record: durable,
      publicKeyHex: durable.publicKeyHex,
    };
  }
  const scopedLocal = readIdentityRecordFromLocalStorage(profileId);
  if (scopedLocal) {
    return {
      profileId,
      record: scopedLocal,
      publicKeyHex: scopedLocal.publicKeyHex,
    };
  }
  const { record } = await getStoredIdentity();
  return {
    profileId,
    record: record ?? null,
    publicKeyHex: record?.publicKeyHex ?? null,
  };
};

export const runAuthKernelCreateIdentity = async (params: Readonly<{
  profileId: string;
  passphrase: Passphrase;
  username?: string;
  staySignedIn?: boolean;
}>): Promise<IdentityRecord> => {
  assertAuthKernelProfileScope(params.profileId);
  await authKernelIdentityActions.createIdentity({
    passphrase: params.passphrase,
    username: params.username,
    staySignedIn: resolveStaySignedIn({ staySignedIn: params.staySignedIn }),
  });
  const snapshot = getIdentitySnapshot();
  if (snapshot.status !== "unlocked" || !snapshot.stored) {
    throw new Error("Identity create did not reach unlocked state");
  }
  return snapshot.stored;
};

export const runAuthKernelImportIdentity = async (params: Readonly<{
  profileId: string;
  privateKeyHex: PrivateKeyHex;
  passphrase: Passphrase;
  username?: string;
  staySignedIn?: boolean;
}>): Promise<IdentityRecord> => {
  assertAuthKernelProfileScope(params.profileId);
  await authKernelIdentityActions.importIdentity({
    privateKeyHex: params.privateKeyHex,
    passphrase: params.passphrase,
    username: params.username,
    staySignedIn: resolveStaySignedIn({ staySignedIn: params.staySignedIn }),
  });
  const snapshot = getIdentitySnapshot();
  if (snapshot.status !== "unlocked" || !snapshot.stored) {
    throw new Error("Identity import did not reach unlocked state");
  }
  return snapshot.stored;
};

export const runAuthKernelUnlockWithPassphrase = async (
  params: AuthUnlockOptions & Readonly<{ passphrase: Passphrase; expectedPublicKeyHex: PublicKeyHex }>,
): Promise<Readonly<{ publicKeyHex: PublicKeyHex; staySignedInApplied: boolean }>> => {
  assertAuthKernelProfileScope(params.profileId);
  const staySignedIn = resolveStaySignedIn({ staySignedIn: params.staySignedIn });
  await authKernelIdentityActions.unlockIdentity({
    passphrase: params.passphrase,
    staySignedIn,
  });
  const snapshot = getIdentitySnapshot();
  if (snapshot.status !== "unlocked" || snapshot.stored?.publicKeyHex !== params.expectedPublicKeyHex) {
    throw new Error("Passphrase unlock did not reach unlocked state for expected identity");
  }
  return {
    publicKeyHex: snapshot.stored.publicKeyHex,
    staySignedInApplied: staySignedIn,
  };
};

export const runAuthKernelUnlockWithPrivateKey = async (
  params: AuthUnlockOptions & Readonly<{ privateKeyHex: PrivateKeyHex; expectedPublicKeyHex: PublicKeyHex }>,
): Promise<Readonly<{ publicKeyHex: PublicKeyHex; staySignedInApplied: boolean }>> => {
  assertAuthKernelProfileScope(params.profileId);
  const staySignedIn = resolveStaySignedIn({ staySignedIn: params.staySignedIn });
  await authKernelIdentityActions.unlockWithPrivateKeyHex({
    privateKeyHex: params.privateKeyHex,
    staySignedIn,
  });
  const snapshot = getIdentitySnapshot();
  if (snapshot.status !== "unlocked" || snapshot.stored?.publicKeyHex !== params.expectedPublicKeyHex) {
    throw new Error("Private key unlock did not reach unlocked state for expected identity");
  }
  return {
    publicKeyHex: snapshot.stored.publicKeyHex,
    staySignedInApplied: staySignedIn,
  };
};

export const revokeAuthKernelDeviceUnlockMaterial = async (profileId: string): Promise<void> => {
  assertAuthKernelProfileScope(profileId);
  clearDeviceTrustArtifacts({ profileId });
  await endNativeDeviceSignInBestEffort();
};

export const rehydrateAuthKernelIdentityForActiveProfile = async (): Promise<void> => {
  await useIdentityInternals.rehydrateIdentityForActiveProfile();
};

export const retryAuthKernelNativeSessionUnlock = async (): Promise<boolean> => (
  useIdentityInternals.retryNativeSessionUnlockAction()
);

/** AUTH-K2 boot owner — identity snapshot via single legacy bridge. */
export { getIdentitySnapshot };
