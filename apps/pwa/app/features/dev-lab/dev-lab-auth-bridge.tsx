"use client";

import { useEffect } from "react";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { decodePrivateKey } from "@/app/features/auth/utils/decode-private-key";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { isDevLabEnabled } from "./dev-lab-policy";
import { resolveDevLabAccount, type DevLabAccountId } from "./dev-lab-accounts";
import { DevLabNativeGateListenerBridge } from "./dev-lab-native-gate-listener-bridge";
import { registerDevLabAuthHandlers } from "./dev-lab-install";

/**
 * Registers programmatic unlock handlers on window.obscurDevLab (dev builds only).
 * Must mount inside AuthGateway so window runtime unlock APIs are available.
 */
export const DevLabAuthBridge = (): null => {
  const runtime = useWindowRuntime();
  const identity = useIdentity();

  useEffect(() => {
    if (!isDevLabEnabled()) {
      return;
    }

    const unlockAccount = async (accountId: DevLabAccountId = "tester1"): Promise<void> => {
      const account = resolveDevLabAccount(accountId);
      const hasStoredIdentity = identity.state.stored != null;

      if (hasStoredIdentity) {
        if (account.privateKeyHex) {
          await runtime.unlockBoundProfileWithPrivateKeyHex({
            privateKeyHex: account.privateKeyHex as PrivateKeyHex,
          });
          return;
        }
        await runtime.unlockBoundProfile({ passphrase: account.password as Passphrase });
        return;
      }

      const privateKeyHex = account.privateKeyHex
        ?? (account.nsec ? decodePrivateKey(account.nsec) : null);
      if (!privateKeyHex) {
        throw new Error(`Dev Lab account ${accountId} has no importable key material.`);
      }
      await runtime.importIdentityForBoundProfile({
        privateKeyHex: privateKeyHex as PrivateKeyHex,
        passphrase: account.password as Passphrase,
        username: account.username,
      });
    };

    registerDevLabAuthHandlers({
      unlockAccount,
      getAuthStatus: () => ({
        identityStatus: identity.state.status,
        runtimePhase: runtime.snapshot.phase,
        profileId: runtime.snapshot.session.profileId,
      }),
    });

    return () => {
      registerDevLabAuthHandlers(null);
    };
  }, [
    identity.state.status,
    runtime,
    runtime.snapshot.phase,
    runtime.snapshot.session.profileId,
    runtime.unlockBoundProfile,
    runtime.unlockBoundProfileWithPrivateKeyHex,
    runtime.importIdentityForBoundProfile,
    identity.state.stored,
  ]);

  return <DevLabNativeGateListenerBridge />;
};
