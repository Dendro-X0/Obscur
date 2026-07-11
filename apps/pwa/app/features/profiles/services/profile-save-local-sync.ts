"use client";

import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { encryptedAccountBackupService } from "@/app/features/account-sync/services/encrypted-account-backup-service";
import { getStoredIdentity } from "@/app/features/auth/utils/get-stored-identity";
import { saveStoredIdentity } from "@/app/features/auth/utils/save-stored-identity";
import type { RelayPoolLike } from "@/app/features/relays/lib/nostr-core-relay";
import { logAppEvent } from "@/app/shared/log-app-event";

const LOCAL_BACKUP_REFRESH_TIMEOUT_MS = 12_000;

const withTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("local_account_backup_refresh_timed_out"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

/** Keeps identity display name aligned with the saved profile draft. */
export const syncIdentityUsernameFromProfileSave = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  username: string;
}>): Promise<void> => {
  const trimmedUsername = params.username.trim();
  if (!trimmedUsername) {
    return;
  }
  const stored = (await getStoredIdentity()).record;
  if (!stored || stored.publicKeyHex !== params.publicKeyHex) {
    return;
  }
  const storedUsername = stored.username?.trim() ?? "";
  if (storedUsername === trimmedUsername) {
    return;
  }
  await saveStoredIdentity({
    record: {
      ...stored,
      username: trimmedUsername,
    },
  });
};

/**
 * Local-first profile save: identity + encrypted backup snapshot refresh.
 * Relay publish may still be partial; export/restart must not depend on quorum.
 */
export const syncLocalAccountSnapshotAfterProfileSave = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex | null;
  username: string;
  relayPool?: RelayPoolLike;
  enabledRelayUrls?: ReadonlyArray<string>;
}>): Promise<Readonly<{ identitySynced: boolean; backupRefreshed: boolean }>> => {
  let identitySynced = false;
  let backupRefreshed = false;

  try {
    await syncIdentityUsernameFromProfileSave({
      publicKeyHex: params.publicKeyHex,
      username: params.username,
    });
    identitySynced = true;
  } catch (error) {
    logAppEvent({
      name: "profiles.profile_save_identity_sync_failed",
      level: "warn",
      scope: { feature: "profiles", action: "profile_save" },
      context: {
        publicKeySuffix: params.publicKeyHex.slice(-8),
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }

  if (!params.privateKeyHex || !params.relayPool) {
    return { identitySynced, backupRefreshed };
  }

  try {
    await withTimeout(
      encryptedAccountBackupService.publishEncryptedAccountBackup({
        publicKeyHex: params.publicKeyHex,
        privateKeyHex: params.privateKeyHex,
        pool: params.relayPool,
        scopedRelayUrls: params.enabledRelayUrls,
      }),
      LOCAL_BACKUP_REFRESH_TIMEOUT_MS,
    );
    backupRefreshed = true;
  } catch (error) {
    logAppEvent({
      name: "profiles.profile_save_backup_refresh_failed",
      level: "warn",
      scope: { feature: "profiles", action: "profile_save" },
      context: {
        publicKeySuffix: params.publicKeyHex.slice(-8),
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }

  return { identitySynced, backupRefreshed };
};
