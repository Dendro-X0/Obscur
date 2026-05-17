"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayPoolLike } from "@/app/features/relays/lib/nostr-core-relay";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { accountProjectionRuntime } from "../services/account-projection-runtime";

type UseAccountProjectionRuntimeParams = Readonly<{
  publicKeyHex: PublicKeyHex | null;
  privateKeyHex: PrivateKeyHex | null;
  pool: RelayPoolLike & Readonly<{
    sendToOpen: (payload: string) => void;
    subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  }>;
}>;

const getServerSnapshot = () => accountProjectionRuntime.getSnapshot();

export const useAccountProjectionRuntime = (params: UseAccountProjectionRuntimeParams) => {
  const snapshot = useSyncExternalStore(
    accountProjectionRuntime.subscribe,
    accountProjectionRuntime.getSnapshot,
    getServerSnapshot
  );
  const lastBootstrapScopeKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!params.publicKeyHex || !params.privateKeyHex) {
      lastBootstrapScopeKeyRef.current = null;
      accountProjectionRuntime.reset();
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
    snapshot.phase,
    snapshot.profileId,
    snapshot.status,
  ]);

  return useMemo(() => ({
    snapshot,
  }), [snapshot]);
};
