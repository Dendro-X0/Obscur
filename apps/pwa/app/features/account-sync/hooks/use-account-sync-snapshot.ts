"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { accountSyncStatusStore } from "../services/account-sync-status-store";
import type { AccountSyncSnapshot } from "../account-sync-contracts";
import { useTanstackQueryRuntime } from "@/app/features/query/providers/tanstack-query-runtime-provider";
import { queryKeyFactory } from "@/app/features/query/services/query-key-factory";
import { createQueryScope } from "@/app/features/query/services/query-scope";
import { markTanstackQueryPath } from "@/app/features/query/services/tanstack-query-diagnostics";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";

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
      profileId: getActiveProfileIdSafe(),
      publicKeyHex: snapshot.publicKeyHex,
    })
  ), [snapshot.publicKeyHex, tanstackQueryRuntime?.scope]);

  const queryKey = useMemo(() => (
    queryKeyFactory.accountSyncSnapshot({ scope })
  ), [scope]);

  useEffect(() => {
    if (!tanstackQueryRuntime?.enabled) {
      return;
    }
    tanstackQueryRuntime.queryClient.setQueryData(queryKey, snapshot);
  }, [queryKey, snapshot, tanstackQueryRuntime]);

  return snapshot;
};
