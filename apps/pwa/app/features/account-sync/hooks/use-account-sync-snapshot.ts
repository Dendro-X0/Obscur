"use client";

import { useSyncExternalStore } from "react";
import { accountSyncStatusStore } from "../services/account-sync-status-store";
import type { AccountSyncSnapshot } from "../account-sync-contracts";

const serverSnapshot: AccountSyncSnapshot = {
  publicKeyHex: null,
  status: "identity_only",
  portabilityStatus: "unknown",
  phase: "idle",
  message: "Idle",
};

export const useAccountSyncSnapshot = (): AccountSyncSnapshot => {
  return useSyncExternalStore(
    accountSyncStatusStore.subscribe,
    accountSyncStatusStore.getSnapshot,
    () => serverSnapshot
  );
};
