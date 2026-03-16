"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayPoolLike } from "@/app/features/relays/lib/nostr-core-relay";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
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

  useEffect(() => {
    if (!params.publicKeyHex || !params.privateKeyHex) {
      accountProjectionRuntime.reset();
      return;
    }
    const profileId = getActiveProfileIdSafe();
    const snapshotBoundToActiveAccount = (
      snapshot.profileId === profileId
      && snapshot.accountPublicKeyHex === params.publicKeyHex
    );
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
    void accountProjectionRuntime.bootstrapAndReplay({
      profileId,
      accountPublicKeyHex: params.publicKeyHex,
      privateKeyHex: params.privateKeyHex,
      pool: params.pool,
    });
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
