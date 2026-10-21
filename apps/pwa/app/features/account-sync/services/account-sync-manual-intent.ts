/**
 * Settings-intent account sync — Slice 2 thin-webview.
 * Unlock must not auto-rehydrate; Profile Settings triggers restore explicitly.
 */

import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logAppEvent } from "@/app/shared/log-app-event";
import { accountProjectionRuntime } from "./account-projection-runtime";
import { accountRehydrateService } from "./account-rehydrate-service";
import { accountSyncStatusStore } from "./account-sync-status-store";
import { encryptedAccountBackupService } from "./encrypted-account-backup-service";

export type AccountSyncManualIntentResult = Readonly<{
  ok: boolean;
  message: string;
}>;

type RehydratePool = Parameters<typeof accountRehydrateService.rehydrateAccount>[0]["pool"];

export const runManualAccountSyncRestore = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  pool: RehydratePool;
}>): Promise<AccountSyncManualIntentResult> => {
  accountSyncStatusStore.updateSnapshot({
    publicKeyHex: params.publicKeyHex,
    phase: "restoring_account_data",
    status: "identity_only",
    message: "Restoring account data (manual)…",
  });
  logAppEvent({
    name: "account_sync.manual_restore_attempt",
    level: "info",
    scope: { feature: "account-sync", action: "manual_restore" },
    context: { profileId: getResolvedProfileId() },
  });
  try {
    const report = await accountRehydrateService.rehydrateAccount({
      publicKeyHex: params.publicKeyHex,
      privateKeyHex: params.privateKeyHex,
      pool: params.pool,
      cacheOnlyEncryptedBackup: false,
    });
    const restore = await encryptedAccountBackupService.restoreEncryptedAccountBackup({
      publicKeyHex: params.publicKeyHex,
      privateKeyHex: params.privateKeyHex,
      pool: params.pool,
      profileId: getResolvedProfileId(),
      appendCanonicalEvents: accountProjectionRuntime.appendCanonicalEvents.bind(accountProjectionRuntime),
    });
    const applied = Boolean(restore.payload) && !restore.degradedReason;
    const message = applied
      ? "Account restored from relays (manual)"
      : restore.degradedReason
        ? `Restore degraded: ${restore.degradedReason}`
        : "No encrypted backup found on relays";
    accountSyncStatusStore.updateSnapshot({
      publicKeyHex: params.publicKeyHex,
      phase: "ready",
      status: applied ? "private_restored" : restore.hasBackup ? "degraded" : "identity_only",
      message,
      lastRelayFailureReason: restore.degradedReason,
    });
    logAppEvent({
      name: "account_sync.manual_restore_result",
      level: applied ? "info" : "warn",
      scope: { feature: "account-sync", action: "manual_restore" },
      context: {
        applied,
        hasBackup: restore.hasBackup,
        relayCount: report.relayList?.length ?? 0,
      },
    });
    return { ok: applied || !restore.degradedReason, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    accountSyncStatusStore.updateSnapshot({
      publicKeyHex: params.publicKeyHex,
      phase: "ready",
      status: "degraded",
      message: `Manual restore failed: ${message}`,
      lastRelayFailureReason: message,
    });
    return { ok: false, message };
  }
};
