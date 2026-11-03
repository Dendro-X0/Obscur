/**
 * Settings-intent account sync — Slice 2 thin-webview.
 * Unlock must not auto-rehydrate; Profile Settings triggers restore explicitly.
 */

import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { peerTrustInternals } from "@/app/features/network/hooks/use-peer-trust";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { getRelaySnapshot } from "@/app/features/relays/lib/nostr-core-relay";
import { logAppEvent } from "@/app/shared/log-app-event";
import { accountProjectionRuntime } from "./account-projection-runtime";
import { accountRehydrateService } from "./account-rehydrate-service";
import { accountSyncChatStatePort } from "./account-sync-chat-state-port";
import { accountSyncStatusStore } from "./account-sync-status-store";
import { encryptedAccountBackupService } from "./encrypted-account-backup-service";
import { getPersistedMessageCount } from "./restore-merge-chat-state";

export type AccountSyncManualIntentResult = Readonly<{
  ok: boolean;
  message: string;
}>;

type RehydratePool = Parameters<typeof accountRehydrateService.rehydrateAccount>[0]["pool"];

const countOpenRelays = (pool: RehydratePool): number => (
  getRelaySnapshot(pool).openRelayCount
);

const buildAppliedRestoreMessage = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
}>): string => {
  const acceptedCount = peerTrustInternals
    .loadFromStorage(params.publicKeyHex, params.profileId)
    .acceptedPeers.length;
  const messageCount = getPersistedMessageCount(
    accountSyncChatStatePort.load(params.publicKeyHex, { profileId: params.profileId }),
  );
  if (acceptedCount === 0 && messageCount === 0) {
    return "Account restored from relays, but the backup had no trusted contacts or chat history — re-add people or import a fuller backup. Older messages stay on the other device unless they were in this backup.";
  }
  if (acceptedCount === 0) {
    return "Account restored from relays, but no trusted contacts were in the backup — re-add people or import a fuller backup.";
  }
  if (messageCount === 0) {
    return `Account restored from relays (${acceptedCount} trusted contact${acceptedCount === 1 ? "" : "s"}), but this backup had no chat history. Older DMs stay on the other device unless you import a fuller backup.`;
  }
  return `Account restored from relays (${acceptedCount} trusted contact${acceptedCount === 1 ? "" : "s"}). Display names load when relays stay online.`;
};

export const runManualAccountSyncRestore = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  pool: RehydratePool;
}>): Promise<AccountSyncManualIntentResult> => {
  const profileId = getResolvedProfileId();
  const openRelayCount = countOpenRelays(params.pool);
  if (openRelayCount === 0) {
    const message = "No open relays — enable at least one relay in Settings → Relays, wait until connected, then restore again.";
    accountSyncStatusStore.updateSnapshot({
      publicKeyHex: params.publicKeyHex,
      phase: "ready",
      status: "degraded",
      message,
      lastRelayFailureReason: message,
    });
    logAppEvent({
      name: "account_sync.manual_restore_blocked_no_open_relays",
      level: "warn",
      scope: { feature: "account-sync", action: "manual_restore" },
      context: { profileId, openRelayCount },
    });
    return { ok: false, message };
  }

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
    context: { profileId, openRelayCount },
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
      profileId,
      appendCanonicalEvents: accountProjectionRuntime.appendCanonicalEvents.bind(accountProjectionRuntime),
    });
    const applied = Boolean(restore.payload) && !restore.degradedReason;
    const message = applied
      ? buildAppliedRestoreMessage({ publicKeyHex: params.publicKeyHex, profileId })
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
        openRelayCount,
        acceptedPeerCount: peerTrustInternals.loadFromStorage(params.publicKeyHex, profileId).acceptedPeers.length,
      },
    });
    // Only treat an applied payload as success — empty/missing backup must not
    // dismiss the continuity gate as if private state returned.
    return { ok: applied, message };
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
