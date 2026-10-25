"use client";

import { useCallback, useMemo } from "react";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { clearAuthSessionPersistence } from "@/app/features/auth/utils/clear-auth-session-persistence";
import { lockAppSession } from "@/app/features/auth/services/lock-app-session";
import type { SessionUnlockOptions } from "@/app/features/auth/services/device-session-consent";
import type { PoWDifficulty } from "@/app/features/auth/services/pow-key-generator";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import {
  runAuthKernelBoundProfileCreate,
  runAuthKernelBoundProfileCreatePoW,
  runAuthKernelBoundProfileImport,
  runAuthKernelBoundProfileLock,
  runAuthKernelBoundProfileSignOut,
  runAuthKernelBoundProfileUnlockWithPassphrase,
} from "../auth-kernel-bound-profile-auth";
import { useAuthKernelPorts } from "../auth-kernel-provider";
import {
  evaluateAuthKernelRegistrationGate,
  type AuthKernelRegistrationGateResult,
} from "../auth-kernel-registration-gate";
import { resolveBoundAuthProfileId } from "./resolve-bound-auth-profile-id";

export function useAuthKernelSurfaceActions(): Readonly<{
  ports: ReturnType<typeof useAuthKernelPorts>;
  evaluateRegistrationGate: (profileId: string) => Promise<AuthKernelRegistrationGateResult>;
  createIdentityForBoundProfile: (
    params: Readonly<{ passphrase: Passphrase; username?: string } & SessionUnlockOptions>,
  ) => Promise<void>;
  createPoWIdentityForBoundProfile: (
    params: Readonly<{
      passphrase: Passphrase;
      username?: string;
      difficulty: PoWDifficulty;
    } & SessionUnlockOptions>,
  ) => Promise<void>;
  importIdentityForBoundProfile: (
    params: Readonly<{
      privateKeyHex: PrivateKeyHex;
      passphrase: Passphrase;
      username?: string;
    } & SessionUnlockOptions>,
  ) => Promise<void>;
  unlockBoundProfileWithPassphrase: (
    params: Readonly<{ passphrase: Passphrase } & SessionUnlockOptions>,
  ) => Promise<void>;
  signOutBoundProfileWindow: (profileId: string) => Promise<void>;
  lockBoundProfileWindow: () => Promise<void>;
}> {
  const ports = useAuthKernelPorts();
  const runtime = useWindowRuntime();
  const identity = useIdentity();
  const profileId = resolveBoundAuthProfileId(runtime.snapshot.session.profileId);

  const evaluateRegistrationGate = useCallback(
    (boundProfileId: string) => evaluateAuthKernelRegistrationGate(boundProfileId),
    [],
  );

  const createIdentityForBoundProfile = useCallback(async (
    params: Readonly<{ passphrase: Passphrase; username?: string } & SessionUnlockOptions>,
  ): Promise<void> => {
    await runAuthKernelBoundProfileCreate(ports, { profileId, ...params });
  }, [ports, profileId]);

  const createPoWIdentityForBoundProfile = useCallback(async (
    params: Readonly<{
      passphrase: Passphrase;
      username?: string;
      difficulty: PoWDifficulty;
    } & SessionUnlockOptions>,
  ): Promise<void> => {
    await runAuthKernelBoundProfileCreatePoW(ports, { profileId, ...params });
  }, [ports, profileId]);

  const importIdentityForBoundProfile = useCallback(async (
    params: Readonly<{
      privateKeyHex: PrivateKeyHex;
      passphrase: Passphrase;
      username?: string;
    } & SessionUnlockOptions>,
  ): Promise<void> => {
    await runAuthKernelBoundProfileImport(ports, { profileId, ...params });
  }, [ports, profileId]);

  const unlockBoundProfileWithPassphrase = useCallback(async (
    params: Readonly<{ passphrase: Passphrase } & SessionUnlockOptions>,
  ): Promise<void> => {
    const stored = identity.state.stored;
    if (!stored?.publicKeyHex) {
      throw new Error("No local account is stored for this profile window.");
    }
    await runAuthKernelBoundProfileUnlockWithPassphrase(ports, {
      profileId,
      passphrase: params.passphrase,
      expectedPublicKeyHex: stored.publicKeyHex as PublicKeyHex,
      staySignedIn: params.staySignedIn,
    });
  }, [identity.state.stored, ports, profileId]);

  const signOutBoundProfileWindow = useCallback(async (targetProfileId: string): Promise<void> => {
    clearAuthSessionPersistence({ profileId: targetProfileId });
    await runAuthKernelBoundProfileSignOut(ports, targetProfileId);
    identity.lockIdentity();
  }, [identity, ports]);

  const lockBoundProfileWindow = useCallback(async (): Promise<void> => {
    // Demote JS identity + manual-lock flag before native clear so in-flight auto-unlock
    // paths abort instead of re-promoting the unlocked shell after lockSession.
    await lockAppSession({ lockBoundProfile: runtime.lockBoundProfile });
    try {
      await runAuthKernelBoundProfileLock(ports, profileId);
    } catch (error) {
      console.warn("[AuthKernel] lockSession best-effort failed after app lock:", error);
    }
  }, [ports, profileId, runtime.lockBoundProfile]);

  return useMemo(() => ({
    ports,
    evaluateRegistrationGate,
    createIdentityForBoundProfile,
    createPoWIdentityForBoundProfile,
    importIdentityForBoundProfile,
    unlockBoundProfileWithPassphrase,
    signOutBoundProfileWindow,
    lockBoundProfileWindow,
  }), [
    ports,
    evaluateRegistrationGate,
    createIdentityForBoundProfile,
    createPoWIdentityForBoundProfile,
    importIdentityForBoundProfile,
    unlockBoundProfileWithPassphrase,
    signOutBoundProfileWindow,
    lockBoundProfileWindow,
  ]);
}
