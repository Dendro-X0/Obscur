"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayPoolLike } from "@/app/features/relays/lib/nostr-core-relay";
import type { RelayReadinessState } from "@/app/features/relays/services/relay-recovery-policy";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { accountProjectionRuntime } from "../services/account-projection-runtime";
import { isExperimentOfflineStubEnabled } from "@/app/features/runtime/experiment-shell-policy";

type UseAccountProjectionRuntimeParams = Readonly<{
  publicKeyHex: PublicKeyHex | null;
  privateKeyHex: PrivateKeyHex | null;
  pool: RelayPoolLike & Readonly<{
    sendToOpen: (payload: string) => void;
    subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  }>;
  relayRecoveryReadiness?: RelayReadinessState;
  writableRelayCount?: number;
}>;

const getServerSnapshot = () => accountProjectionRuntime.getSnapshot();

export const useAccountProjectionRuntime = (params: UseAccountProjectionRuntimeParams) => {
  const snapshot = useSyncExternalStore(
    accountProjectionRuntime.subscribe,
    accountProjectionRuntime.getSnapshot,
    getServerSnapshot
  );
  const lastBootstrapScopeKeyRef = useRef<string | null>(null);
  const previousRelayReadinessRef = useRef<RelayReadinessState | null>(null);

  useEffect(() => {
    if (!params.publicKeyHex || !params.privateKeyHex) {
      lastBootstrapScopeKeyRef.current = null;
      accountProjectionRuntime.reset();
      return;
    }
    if (isExperimentOfflineStubEnabled()) {
      const profileId = getResolvedProfileId();
      if (!profileId) {
        return;
      }
      const scopeKey = `${profileId}:${params.publicKeyHex}`;
      if (lastBootstrapScopeKeyRef.current === scopeKey) {
        return;
      }
      lastBootstrapScopeKeyRef.current = scopeKey;
      accountProjectionRuntime.markExperimentShellReady({
        profileId,
        accountPublicKeyHex: params.publicKeyHex,
      });
      return;
    }
    const profileId = getResolvedProfileId();
    const scopeKey = `${profileId}:${params.publicKeyHex}`;
    const snapshotBoundToActiveAccount = (
      snapshot.profileId === profileId
      && snapshot.accountPublicKeyHex === params.publicKeyHex
    );
    const snapshotHasAccountScope = Boolean(snapshot.profileId || snapshot.accountPublicKeyHex);
    if (!snapshotBoundToActiveAccount && snapshotHasAccountScope) {
      lastBootstrapScopeKeyRef.current = null;
      accountProjectionRuntime.reset();
    }
    const alreadyReadyForActiveAccount = (
      snapshotBoundToActiveAccount
      && snapshot.status === "ready"
    );
    const alreadyBootstrappingOrReplayingForActiveAccount = (
      snapshotBoundToActiveAccount
      && (snapshot.phase === "bootstrapping" || snapshot.phase === "replaying_event_log")
    );
    if (alreadyReadyForActiveAccount || alreadyBootstrappingOrReplayingForActiveAccount) {
      return;
    }
    // Do not auto-rebootstrap a failed projection on every render; wait for scope change.
    if (snapshotBoundToActiveAccount && snapshot.phase === "degraded" && snapshot.lastError) {
      return;
    }
    if (lastBootstrapScopeKeyRef.current === scopeKey) {
      return;
    }
    if (!profileId) {
      return;
    }
    const accountPublicKeyHex = params.publicKeyHex;
    const privateKeyHex = params.privateKeyHex;
    lastBootstrapScopeKeyRef.current = scopeKey;
    void (async () => {
      try {
        await accountProjectionRuntime.bootstrapAndReplay({
          profileId,
          accountPublicKeyHex,
          privateKeyHex,
          pool: params.pool,
        });
      } catch {
        lastBootstrapScopeKeyRef.current = null;
      }
    })();
  }, [
    params.pool,
    params.privateKeyHex,
    params.publicKeyHex,
    snapshot.accountPublicKeyHex,
    snapshot.lastError,
    snapshot.phase,
    snapshot.profileId,
    snapshot.status,
  ]);

  useEffect(() => {
    if (!params.publicKeyHex || !params.privateKeyHex) {
      previousRelayReadinessRef.current = null;
      return;
    }

    const currentReadiness = params.relayRecoveryReadiness ?? null;
    const previousReadiness = previousRelayReadinessRef.current;
    previousRelayReadinessRef.current = currentReadiness;

    if (!currentReadiness || previousReadiness === null) {
      return;
    }

    const recoveredToHealthy = (
      previousReadiness !== "healthy"
      && currentReadiness === "healthy"
      && (params.writableRelayCount ?? 0) > 0
    );
    if (!recoveredToHealthy) {
      return;
    }

    const profileId = getResolvedProfileId();
    const snapshotBoundToActiveAccount = (
      snapshot.profileId === profileId
      && snapshot.accountPublicKeyHex === params.publicKeyHex
    );
    if (
      !snapshotBoundToActiveAccount
      || snapshot.phase !== "degraded"
      || !snapshot.lastError
    ) {
      return;
    }

    lastBootstrapScopeKeyRef.current = null;
    const accountPublicKeyHex = params.publicKeyHex;
    const privateKeyHex = params.privateKeyHex;
    void accountProjectionRuntime.bootstrapAndReplay({
      profileId,
      accountPublicKeyHex,
      privateKeyHex,
      pool: params.pool,
    });
  }, [
    params.pool,
    params.privateKeyHex,
    params.publicKeyHex,
    params.relayRecoveryReadiness,
    params.writableRelayCount,
    snapshot.accountPublicKeyHex,
    snapshot.lastError,
    snapshot.phase,
    snapshot.profileId,
  ]);

  return useMemo(() => ({
    snapshot,
  }), [snapshot]);
};
