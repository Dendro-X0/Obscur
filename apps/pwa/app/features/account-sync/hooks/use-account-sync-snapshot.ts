"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { areAccountSyncSnapshotsEqual } from "@/app/shared/store-snapshot-equality";
import { accountSyncStatusStore } from "../services/account-sync-status-store";
import type { AccountSyncSnapshot } from "../account-sync-contracts";
import { useTanstackQueryRuntime } from "@/app/features/query/providers/tanstack-query-runtime-provider";
import { queryKeyFactory } from "@/app/features/query/services/query-key-factory";
import { createQueryScope } from "@/app/features/query/services/query-scope";
import { markTanstackQueryPath } from "@/app/features/query/services/tanstack-query-diagnostics";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

const serverSnapshot: AccountSyncSnapshot = {
  publicKeyHex: null,
  status: "identity_only",
  portabilityStatus: "unknown",
  phase: "idle",
  message: "Idle",
};

export const useAccountSyncSnapshot = (): AccountSyncSnapshot => {
  const tanstackQueryRuntime = useTanstackQueryRuntime();
  const snapshot = useSyncExternalStore(
    accountSyncStatusStore.subscribe,
    accountSyncStatusStore.getSnapshot,
    () => serverSnapshot
  );

  useEffect(() => {
    markTanstackQueryPath("account_sync_snapshot", tanstackQueryRuntime?.enabled === true ? "tanstack" : "legacy");
  }, [tanstackQueryRuntime?.enabled]);

  const scope = useMemo(() => (
    tanstackQueryRuntime?.scope ?? createQueryScope({
      profileId: getResolvedProfileId(),
      publicKeyHex: snapshot.publicKeyHex,
    })
  ), [snapshot.publicKeyHex, tanstackQueryRuntime?.scope]);

  const queryKey = useMemo(() => (
    queryKeyFactory.accountSyncSnapshot({ scope })
  ), [scope]);

  const lastBridgedSnapshotRef = useRef<AccountSyncSnapshot | null>(null);
  useEffect(() => {
    if (!tanstackQueryRuntime?.enabled) {
      return;
    }
    const previous = lastBridgedSnapshotRef.current;
    if (previous && areAccountSyncSnapshotsEqual(previous, snapshot)) {
      return;
    }
    lastBridgedSnapshotRef.current = snapshot;
    tanstackQueryRuntime.queryClient.setQueryData(queryKey, snapshot);
  }, [queryKey, snapshot, tanstackQueryRuntime]);

  return snapshot;
};
