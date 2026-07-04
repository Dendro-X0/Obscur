import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import {
  resolveStaySignedIn,
  type SessionUnlockOptions,
} from "@/app/features/auth/services/device-session-consent";
import { assertAccountUnlockAllowedAsync } from "@/app/features/profiles/services/profile-account-unlock-guard";
import { resolveCurrentDesktopWindowLabel } from "@/app/features/profiles/services/desktop-window-boot-payload";
import { assertProfileSlotIsEmptyForNewIdentity } from "@/app/features/profiles/services/profile-slot-login-guard";
import { getIdentitySnapshot } from "@/app/features/auth/hooks/use-identity";
import {
  beginBoundProfileUnlock,
  finalizeBoundProfileUnlockSuccess,
  resetBoundProfileToAuthRequired,
} from "@/app/features/runtime/services/window-runtime-supervisor";
import type { AuthKernelPorts } from "./auth-kernel-ports";

const throwPortFailure = (message?: string): void => {
  throw new Error(message ?? "Auth kernel port call failed");
};

const resetBoundProfileToAuthRequiredUnlessUnlocked = (): void => {
  if (getIdentitySnapshot().status !== "unlocked") {
    resetBoundProfileToAuthRequired();
  }
};

export const runAuthKernelBoundProfileCreate = async (
  ports: AuthKernelPorts,
  params: Readonly<{ profileId: string; passphrase: Passphrase; username?: string } & SessionUnlockOptions>,
): Promise<void> => {
  const profileId = params.profileId.trim();
  const staySignedIn = resolveStaySignedIn(params);
  beginBoundProfileUnlock("create");
  try {
    assertProfileSlotIsEmptyForNewIdentity(profileId);
    const result = await ports.identityRoot.createIdentity({
      profileId,
      passphrase: params.passphrase,
      username: params.username,
    });
    if (result.status === "failed" || !result.value) {
      throwPortFailure(result.message);
    }
    finalizeBoundProfileUnlockSuccess({
      profileId,
      passphrase: params.passphrase,
      trusted: staySignedIn,
    });
  } catch (error) {
    resetBoundProfileToAuthRequiredUnlessUnlocked();
    throw error;
  }
};

export const runAuthKernelBoundProfileImport = async (
  ports: AuthKernelPorts,
  params: Readonly<{
    profileId: string;
    privateKeyHex: PrivateKeyHex;
    passphrase: Passphrase;
    username?: string;
  } & SessionUnlockOptions>,
): Promise<void> => {
  const profileId = params.profileId.trim();
  const staySignedIn = resolveStaySignedIn(params);
  beginBoundProfileUnlock("import");
  try {
    await assertAccountUnlockAllowedAsync({
      profileId,
      incomingPublicKeyHex: derivePublicKeyHex(params.privateKeyHex),
      currentWindowLabel: resolveCurrentDesktopWindowLabel(),
    });
    const result = await ports.identityRoot.importIdentity({
      profileId,
      privateKeyHex: params.privateKeyHex,
      passphrase: params.passphrase,
      username: params.username,
    });
    if (result.status === "failed" || !result.value) {
      throwPortFailure(result.message);
    }
    finalizeBoundProfileUnlockSuccess({
      profileId,
      passphrase: params.passphrase,
      privateKeyHex: params.privateKeyHex,
      trusted: staySignedIn,
    });
  } catch (error) {
    resetBoundProfileToAuthRequiredUnlessUnlocked();
    throw error;
  }
};

export const runAuthKernelBoundProfileUnlockWithPassphrase = async (
  ports: AuthKernelPorts,
  params: Readonly<{
    profileId: string;
    passphrase: Passphrase;
    expectedPublicKeyHex: PublicKeyHex;
  } & SessionUnlockOptions>,
): Promise<void> => {
  const profileId = params.profileId.trim();
  const staySignedIn = resolveStaySignedIn(params);
  beginBoundProfileUnlock("unlock");
  try {
    await assertAccountUnlockAllowedAsync({
      profileId,
      incomingPublicKeyHex: params.expectedPublicKeyHex,
      currentWindowLabel: resolveCurrentDesktopWindowLabel(),
    });
    const result = await ports.deviceUnlock.unlockWithPassphrase({
      profileId,
      passphrase: params.passphrase,
      expectedPublicKeyHex: params.expectedPublicKeyHex,
      staySignedIn: params.staySignedIn,
      context: "unlock",
    });
    if (result.status === "failed" || !result.value) {
      throwPortFailure(result.message);
    }
    finalizeBoundProfileUnlockSuccess({
      profileId,
      passphrase: params.passphrase,
      trusted: staySignedIn,
    });
  } catch (error) {
    resetBoundProfileToAuthRequiredUnlessUnlocked();
    throw error;
  }
};

export const runAuthKernelBoundProfileUnlockWithPrivateKey = async (
  ports: AuthKernelPorts,
  params: Readonly<{
    profileId: string;
    privateKeyHex: PrivateKeyHex;
    expectedPublicKeyHex: PublicKeyHex;
  } & SessionUnlockOptions>,
): Promise<void> => {
  const profileId = params.profileId.trim();
  const staySignedIn = resolveStaySignedIn(params);
  beginBoundProfileUnlock("unlock");
  try {
    await assertAccountUnlockAllowedAsync({
      profileId,
      incomingPublicKeyHex: derivePublicKeyHex(params.privateKeyHex),
      currentWindowLabel: resolveCurrentDesktopWindowLabel(),
    });
    const result = await ports.deviceUnlock.unlockWithPrivateKey({
      profileId,
      privateKeyHex: params.privateKeyHex,
      expectedPublicKeyHex: params.expectedPublicKeyHex,
      staySignedIn: params.staySignedIn,
      context: "raw_unlock",
    });
    if (result.status === "failed" || !result.value) {
      throwPortFailure(result.message);
    }
    finalizeBoundProfileUnlockSuccess({
      profileId,
      privateKeyHex: params.privateKeyHex,
      trusted: staySignedIn,
    });
  } catch (error) {
    resetBoundProfileToAuthRequiredUnlessUnlocked();
    throw error;
  }
};

export const runAuthKernelBoundProfileSignOut = async (
  ports: AuthKernelPorts,
  profileId: string,
): Promise<void> => {
  const trimmed = profileId.trim();
  if (!trimmed) {
    return;
  }
  const result = await ports.runtimeSession.signOutSession(trimmed);
  if (result.status === "failed") {
    throwPortFailure(result.message);
  }
};

export const runAuthKernelBoundProfileLock = async (
  ports: AuthKernelPorts,
  profileId: string,
): Promise<void> => {
  const trimmed = profileId.trim();
  if (!trimmed) {
    return;
  }
  const result = await ports.runtimeSession.lockSession(trimmed);
  if (result.status === "failed") {
    throwPortFailure(result.message);
  }
};
