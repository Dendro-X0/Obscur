"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { EnhancedRelayPoolResult } from "@/app/features/relays/hooks/enhanced-relay-pool";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { logAppEvent } from "@/app/shared/log-app-event";
import { subscribeAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { accountRehydrateService } from "../services/account-rehydrate-service";
import { accountProjectionRuntime } from "../services/account-projection-runtime";
import { encryptedAccountBackupService } from "../services/encrypted-account-backup-service";
import { accountSyncStatusStore } from "../services/account-sync-status-store";
import type {
  AccountSyncBackupPublishReason,
  AccountSyncBackupPublishResult,
  AccountSyncBackupRestoreReason,
  AccountSyncBackupRestoreResult,
  AccountSyncSnapshot,
} from "../account-sync-contracts";

type UseAccountSyncParams = Readonly<{
  publicKeyHex: PublicKeyHex | null;
  privateKeyHex: PrivateKeyHex | null;
  pool: EnhancedRelayPoolResult;
  enabledRelayUrls: ReadonlyArray<string>;
  onRelayListRestored?: (relayList: ReadonlyArray<Readonly<{ url: string; enabled: boolean }>>) => void;
}>;

const stableKey = (publicKeyHex: string | null, privateKeyHex: string | null): string => `${publicKeyHex ?? "none"}::${privateKeyHex ? "ready" : "locked"}`;
const AUTO_BACKUP_INTERVAL_MS = 2 * 60 * 1000;
const MUTATION_BACKUP_COOLDOWN_MS = 10 * 1000;
const ACTIVE_RESTORE_INTERVAL_MS = 60 * 1000;
const ACTIVE_RESTORE_VISIBLE_COOLDOWN_MS = 15 * 1000;
const READY_RESTORE_FOLLOW_UP_DELAY_MS = 12 * 1000;
const STARTUP_FAST_FOLLOW_RESTORE_COOLDOWN_MS = 1_000;
const MUTATION_FAST_FOLLOW_RESTORE_COOLDOWN_MS = 10 * 1000;
const POST_RESTORE_MUTATION_SUPPRESS_MS = 8 * 1000;
type BackupPublishResponse = Awaited<ReturnType<typeof encryptedAccountBackupService.publishEncryptedAccountBackup>>;
type BackupRestoreResponse = Awaited<ReturnType<typeof encryptedAccountBackupService.restoreEncryptedAccountBackup>>;

const wasBackupPublished = (result: BackupPublishResponse): boolean => {
  return result.publishResult.status !== "unsupported";
};
const mapPublishResult = (result: BackupPublishResponse): AccountSyncBackupPublishResult => {
  switch (result.publishResult.status) {
    case "ok":
      return "ok";
    case "partial":
      return "partial";
    case "queued":
      return "queued";
    case "failed":
      return "failed";
    default:
      return "unsupported";
  }
};
const mapRestoreResult = (result: BackupRestoreResponse): AccountSyncBackupRestoreResult => {
  if (!result.hasBackup) {
    return "no_backup";
  }
  if (result.degradedReason) {
    return "degraded";
  }
  return result.payload ? "applied" : "failed";
};
const resolvePublishCooldownMs = (reason: AccountSyncBackupPublishReason): number => {
  if (reason === "pagehide" || reason === "startup") {
    return 0;
  }
  if (reason === "dm_history_changed") {
    return 0;
  }
  if (reason === "message_delete_tombstones_changed") {
    return 0;
  }
  if (reason === "community_membership_changed") {
    return 0;
  }
  if (reason === "mutation") {
    return MUTATION_BACKUP_COOLDOWN_MS;
  }
  return AUTO_BACKUP_INTERVAL_MS;
};
const resolveRestoreCooldownMs = (reason: AccountSyncBackupRestoreReason): number => {
  if (reason === "startup_fast_follow") {
    return STARTUP_FAST_FOLLOW_RESTORE_COOLDOWN_MS;
  }
  if (reason === "mutation_fast_follow") {
    return MUTATION_FAST_FOLLOW_RESTORE_COOLDOWN_MS;
  }
  if (reason === "visible") {
    return ACTIVE_RESTORE_VISIBLE_COOLDOWN_MS;
  }
  if (reason === "follow_up") {
    return READY_RESTORE_FOLLOW_UP_DELAY_MS;
  }
  return ACTIVE_RESTORE_INTERVAL_MS;
};

export const useAccountSync = (params: UseAccountSyncParams) => {
  const [snapshot, setSnapshot] = useState<AccountSyncSnapshot>(() => accountSyncStatusStore.getSnapshot());
  const rehydratedForKeyRef = useRef<string | null>(null);
  const backupInFlightRef = useRef(false);
  const lastBackupAtUnixMsRef = useRef<number>(0);
  const restoreInFlightRef = useRef(false);
  const lastRestoreAtUnixMsRef = useRef<number>(0);
  const lastMutationPublishAtUnixMsRef = useRef<number | null>(null);
  const lastObservedMutationSignalAtUnixMsRef = useRef<number>(0);
  const pendingCommunityMembershipPublishRef = useRef(false);
  const pendingDeferredMutationPublishReasonRef = useRef<AccountSyncBackupPublishReason | null>(null);
  const suppressMutationPublishUntilUnixMsRef = useRef<number>(0);
  const convergenceGuardEnabled = PrivacySettingsService.getSettings().accountSyncConvergenceV091 === true;

  const updateConvergenceDiagnostics = useCallback((
    patch: Partial<NonNullable<AccountSyncSnapshot["convergenceDiagnostics"]>>
  ): void => {
    if (!params.publicKeyHex) {
      return;
    }
    const current = accountSyncStatusStore.getSnapshot().convergenceDiagnostics;
    accountSyncStatusStore.updateSnapshot({
      publicKeyHex: params.publicKeyHex,
      convergenceDiagnostics: {
        guardEnabled: convergenceGuardEnabled,
        ...current,
        ...patch,
      },
    });
  }, [convergenceGuardEnabled, params.publicKeyHex]);

  const maybeRestoreBackup = useCallback(async (
    reason: AccountSyncBackupRestoreReason
  ): Promise<AccountSyncBackupRestoreResult> => {
    if (!params.publicKeyHex || !params.privateKeyHex) {
      updateConvergenceDiagnostics({
        lastBackupRestoreReason: reason,
        lastBackupRestoreAttemptAtUnixMs: Date.now(),
        lastBackupRestoreResult: "skipped_identity",
      });
      return "skipped_identity";
    }
    if (restoreInFlightRef.current) {
      updateConvergenceDiagnostics({
        lastBackupRestoreReason: reason,
        lastBackupRestoreAttemptAtUnixMs: Date.now(),
        lastBackupRestoreResult: "in_flight",
      });
      return "in_flight";
    }
    const now = Date.now();
    const cooldownMs = resolveRestoreCooldownMs(reason);
    if (now - lastRestoreAtUnixMsRef.current < cooldownMs) {
      updateConvergenceDiagnostics({
        lastBackupRestoreReason: reason,
        lastBackupRestoreAttemptAtUnixMs: now,
        lastBackupRestoreResult: "skipped_cooldown",
      });
      return "skipped_cooldown";
    }
    restoreInFlightRef.current = true;
    updateConvergenceDiagnostics({
      lastBackupRestoreReason: reason,
      lastBackupRestoreAttemptAtUnixMs: now,
    });
    logAppEvent({
      name: "account_sync.backup_restore_attempt",
      level: "info",
      scope: { feature: "account_sync", action: "backup_restore" },
      context: {
        reason,
        guardEnabled: convergenceGuardEnabled,
      },
    });
    try {
      const result = await encryptedAccountBackupService.restoreEncryptedAccountBackup({
        publicKeyHex: params.publicKeyHex,
        privateKeyHex: params.privateKeyHex,
        pool: params.pool,
        profileId: getActiveProfileIdSafe(),
        appendCanonicalEvents: accountProjectionRuntime.appendCanonicalEvents.bind(accountProjectionRuntime),
      });
      const mappedResult = mapRestoreResult(result);
      const finishedAtUnixMs = Date.now();
      lastRestoreAtUnixMsRef.current = finishedAtUnixMs;
      const mutationLatencyMs = (
        reason === "mutation_fast_follow" && lastMutationPublishAtUnixMsRef.current
      )
        ? Math.max(0, finishedAtUnixMs - lastMutationPublishAtUnixMsRef.current)
        : undefined;
      if (mappedResult === "applied") {
        suppressMutationPublishUntilUnixMsRef.current = finishedAtUnixMs + POST_RESTORE_MUTATION_SUPPRESS_MS;
        accountSyncStatusStore.updateSnapshot({
          publicKeyHex: params.publicKeyHex,
          phase: "ready",
          status: "private_restored",
          message: "Account sync ready",
          lastRelayFailureReason: undefined,
        });
      } else if (mappedResult === "no_backup") {
        accountSyncStatusStore.updateSnapshot({
          publicKeyHex: params.publicKeyHex,
          phase: "ready",
          status: "identity_only",
          message: "Identity restored, but shared account data was not found on relays",
          lastRelayFailureReason: undefined,
        });
      } else if (mappedResult === "degraded") {
        accountSyncStatusStore.updateSnapshot({
          publicKeyHex: params.publicKeyHex,
          phase: "ready",
          status: "degraded",
          message: "Account restore degraded",
          lastRelayFailureReason: result.degradedReason,
        });
      }
      updateConvergenceDiagnostics({
        lastBackupRestoreReason: reason,
        lastBackupRestoreAttemptAtUnixMs: now,
        lastBackupRestoreResult: mappedResult,
        lastMutationRestoreAtUnixMs: reason === "mutation_fast_follow" ? finishedAtUnixMs : undefined,
        lastMutationConvergenceLatencyMs: mutationLatencyMs,
      });
      logAppEvent({
        name: "account_sync.backup_restore_result",
        level: mappedResult === "failed" ? "warn" : "info",
        scope: { feature: "account_sync", action: "backup_restore" },
        context: {
          reason,
          result: mappedResult,
          guardEnabled: convergenceGuardEnabled,
          convergenceLatencyMs: mutationLatencyMs ?? null,
        },
      });
      return mappedResult;
    } catch (error) {
      lastRestoreAtUnixMsRef.current = Date.now();
      updateConvergenceDiagnostics({
        lastBackupRestoreReason: reason,
        lastBackupRestoreAttemptAtUnixMs: now,
        lastBackupRestoreResult: "failed",
      });
      logAppEvent({
        name: "account_sync.backup_restore_result",
        level: "warn",
        scope: { feature: "account_sync", action: "backup_restore" },
        context: {
          reason,
          result: "failed",
          guardEnabled: convergenceGuardEnabled,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return "failed";
    } finally {
      restoreInFlightRef.current = false;
    }
  }, [convergenceGuardEnabled, params.pool, params.privateKeyHex, params.publicKeyHex, updateConvergenceDiagnostics]);

  const maybePublishBackup = useCallback(async (
    reason: AccountSyncBackupPublishReason
  ): Promise<AccountSyncBackupPublishResult> => {
    const now = Date.now();
    if (reason === "mutation" || reason === "community_membership_changed") {
      lastMutationPublishAtUnixMsRef.current = now;
    }
    if (!params.publicKeyHex || !params.privateKeyHex) {
      updateConvergenceDiagnostics({
        lastBackupPublishReason: reason,
        lastBackupPublishAttemptAtUnixMs: now,
        lastBackupPublishResult: "skipped_identity",
        lastMutationPublishAtUnixMs: (
          reason === "mutation" || reason === "community_membership_changed"
        ) ? now : undefined,
      });
      return "skipped_identity";
    }
    if (backupInFlightRef.current) {
      updateConvergenceDiagnostics({
        lastBackupPublishReason: reason,
        lastBackupPublishAttemptAtUnixMs: now,
        lastBackupPublishResult: "in_flight",
        lastMutationPublishAtUnixMs: (
          reason === "mutation" || reason === "community_membership_changed"
        ) ? now : undefined,
      });
      return "in_flight";
    }
    const cooldownMs = resolvePublishCooldownMs(reason);
    if (now - lastBackupAtUnixMsRef.current < cooldownMs) {
      updateConvergenceDiagnostics({
        lastBackupPublishReason: reason,
        lastBackupPublishAttemptAtUnixMs: now,
        lastBackupPublishResult: "skipped_cooldown",
        lastMutationPublishAtUnixMs: (
          reason === "mutation" || reason === "community_membership_changed"
        ) ? now : undefined,
      });
      return "skipped_cooldown";
    }
    backupInFlightRef.current = true;
    updateConvergenceDiagnostics({
      lastBackupPublishReason: reason,
      lastBackupPublishAttemptAtUnixMs: now,
      lastMutationPublishAtUnixMs: (
        reason === "mutation" || reason === "community_membership_changed"
      ) ? now : undefined,
    });
    logAppEvent({
      name: "account_sync.backup_publish_attempt",
      level: "info",
      scope: { feature: "account_sync", action: "backup_publish" },
      context: {
        reason,
        guardEnabled: convergenceGuardEnabled,
      },
    });
    try {
      const publishResult = await encryptedAccountBackupService.publishEncryptedAccountBackup({
        publicKeyHex: params.publicKeyHex,
        privateKeyHex: params.privateKeyHex,
        pool: params.pool,
        scopedRelayUrls: params.enabledRelayUrls,
      });
      const mappedResult = mapPublishResult(publishResult);
      if (wasBackupPublished(publishResult)) {
        lastBackupAtUnixMsRef.current = Date.now();
      }
      updateConvergenceDiagnostics({
        lastBackupPublishReason: reason,
        lastBackupPublishAttemptAtUnixMs: now,
        lastBackupPublishResult: mappedResult,
      });
      logAppEvent({
        name: "account_sync.backup_publish_result",
        level: mappedResult === "failed" ? "warn" : "info",
        scope: { feature: "account_sync", action: "backup_publish" },
        context: {
          reason,
          result: mappedResult,
          guardEnabled: convergenceGuardEnabled,
        },
      });
      return mappedResult;
    } catch (error) {
      updateConvergenceDiagnostics({
        lastBackupPublishReason: reason,
        lastBackupPublishAttemptAtUnixMs: now,
        lastBackupPublishResult: "error",
      });
      logAppEvent({
        name: "account_sync.backup_publish_result",
        level: "warn",
        scope: { feature: "account_sync", action: "backup_publish" },
        context: {
          reason,
          result: "error",
          guardEnabled: convergenceGuardEnabled,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return "error";
    } finally {
      backupInFlightRef.current = false;
    }
  }, [convergenceGuardEnabled, params.enabledRelayUrls, params.pool, params.privateKeyHex, params.publicKeyHex, updateConvergenceDiagnostics]);

  useEffect(() => accountSyncStatusStore.subscribe(setSnapshot), []);

  useEffect(() => {
    const key = stableKey(params.publicKeyHex, params.privateKeyHex);
    if (!params.publicKeyHex || !params.privateKeyHex) {
      accountSyncStatusStore.resetSnapshot(params.publicKeyHex);
      rehydratedForKeyRef.current = null;
      backupInFlightRef.current = false;
      restoreInFlightRef.current = false;
      lastBackupAtUnixMsRef.current = 0;
      lastRestoreAtUnixMsRef.current = 0;
      lastMutationPublishAtUnixMsRef.current = null;
      lastObservedMutationSignalAtUnixMsRef.current = 0;
      pendingCommunityMembershipPublishRef.current = false;
      suppressMutationPublishUntilUnixMsRef.current = 0;
      return;
    }
    if (rehydratedForKeyRef.current === key) {
      return;
    }
    rehydratedForKeyRef.current = key;
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        const report = await accountRehydrateService.rehydrateAccount({
          publicKeyHex: params.publicKeyHex!,
          privateKeyHex: params.privateKeyHex!,
          pool: params.pool,
          cacheOnlyEncryptedBackup: true,
        });
        if (cancelled) {
          return;
        }
        params.onRelayListRestored?.(report.relayList);

        // Ensure startup restore is applied before the first startup publish.
        // Publishing first on a fresh device can propagate stale/empty local state.
        const startupRestoreResult = await maybeRestoreBackup("startup_fast_follow");
        if (startupRestoreResult !== "applied") {
          logAppEvent({
            name: "account_sync.backup_publish_startup_suppressed",
            level: "warn",
            scope: { feature: "account_sync", action: "backup_publish" },
            context: {
              reason: "startup_restore_not_applied",
              startupRestoreResult,
              guardEnabled: convergenceGuardEnabled,
            },
          });
          return;
        }
        void maybePublishBackup("startup");
      } catch (error) {
        if (cancelled) {
          return;
        }
        accountSyncStatusStore.updateSnapshot({
          publicKeyHex: params.publicKeyHex!,
          phase: "ready",
          status: "degraded",
          message: "Account restore degraded; retrying in background",
          lastRelayFailureReason: error instanceof Error ? error.message : String(error),
        });
        // Keep startup recoverable after transient relay/runtime failures.
        void maybeRestoreBackup("follow_up");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    convergenceGuardEnabled,
    maybePublishBackup,
    maybeRestoreBackup,
    params.onRelayListRestored,
    params.pool,
    params.privateKeyHex,
    params.publicKeyHex,
  ]);

  useEffect(() => {
    if (!params.publicKeyHex || !params.privateKeyHex) {
      pendingDeferredMutationPublishReasonRef.current = null;
      return;
    }
    if (snapshot.phase !== "ready") {
      return;
    }
    const deferredReason = pendingDeferredMutationPublishReasonRef.current;
    if (!deferredReason) {
      return;
    }
    pendingDeferredMutationPublishReasonRef.current = null;
    void (async () => {
      await maybePublishBackup(deferredReason);
      if (convergenceGuardEnabled) {
        await maybeRestoreBackup("mutation_fast_follow");
      }
    })();
  }, [
    convergenceGuardEnabled,
    maybePublishBackup,
    maybeRestoreBackup,
    params.privateKeyHex,
    params.publicKeyHex,
    snapshot.phase,
  ]);

  useEffect(() => {
    if (!params.publicKeyHex || !params.privateKeyHex) {
      return;
    }

    const unsubscribeMutation = subscribeAccountSyncMutation((detail) => {
      if (detail.atUnixMs <= lastObservedMutationSignalAtUnixMsRef.current) {
        return;
      }
      lastObservedMutationSignalAtUnixMsRef.current = detail.atUnixMs;
      const publishReason: AccountSyncBackupPublishReason = detail.reason === "community_membership_changed"
        ? "community_membership_changed"
        : detail.reason === "dm_history_changed"
          ? "dm_history_changed"
        : detail.reason === "message_delete_tombstones_changed"
          ? "message_delete_tombstones_changed"
        : "mutation";
      if (snapshot.phase !== "ready") {
        pendingDeferredMutationPublishReasonRef.current = publishReason;
        logAppEvent({
          name: "account_sync.backup_publish_mutation_deferred_until_ready",
          level: "info",
          scope: { feature: "account_sync", action: "backup_publish" },
          context: {
            mutationReason: detail.reason,
            deferredPublishReason: publishReason,
            phase: snapshot.phase,
            guardEnabled: convergenceGuardEnabled,
          },
        });
        return;
      }
      queueMicrotask(() => {
        if (restoreInFlightRef.current) {
          if (publishReason === "community_membership_changed" && !pendingCommunityMembershipPublishRef.current) {
            pendingCommunityMembershipPublishRef.current = true;
            const flushCommunityMembershipPublish = (): void => {
              if (!pendingCommunityMembershipPublishRef.current) {
                return;
              }
              if (restoreInFlightRef.current) {
                window.setTimeout(flushCommunityMembershipPublish, 250);
                return;
              }
              pendingCommunityMembershipPublishRef.current = false;
              void (async () => {
                await maybePublishBackup("community_membership_changed");
                if (convergenceGuardEnabled) {
                  await maybeRestoreBackup("mutation_fast_follow");
                }
              })();
            };
            window.setTimeout(flushCommunityMembershipPublish, 250);
          }
          logAppEvent({
            name: "account_sync.backup_publish_mutation_suppressed_restore_in_flight",
            level: "info",
            scope: { feature: "account_sync", action: "backup_publish" },
            context: {
              mutationReason: detail.reason,
              guardEnabled: convergenceGuardEnabled,
            },
          });
          return;
        }
        if (
          publishReason !== "community_membership_changed"
          && publishReason !== "dm_history_changed"
          && publishReason !== "message_delete_tombstones_changed"
          && Date.now() < suppressMutationPublishUntilUnixMsRef.current
        ) {
          logAppEvent({
            name: "account_sync.backup_publish_mutation_suppressed_after_restore",
            level: "info",
            scope: { feature: "account_sync", action: "backup_publish" },
            context: {
              mutationReason: detail.reason,
              suppressedUntilUnixMs: suppressMutationPublishUntilUnixMsRef.current,
              guardEnabled: convergenceGuardEnabled,
            },
          });
          return;
        }
        void (async () => {
          await maybePublishBackup(publishReason);
          if (convergenceGuardEnabled) {
            await maybeRestoreBackup("mutation_fast_follow");
          }
        })();
      });
    });

    if (snapshot.phase !== "ready") {
      return () => {
        unsubscribeMutation();
      };
    }

    const intervalId = window.setInterval(() => {
      void maybePublishBackup("interval");
    }, AUTO_BACKUP_INTERVAL_MS);

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        void maybePublishBackup("visible");
      }
    };

    const handlePageHide = (): void => {
      void maybePublishBackup("pagehide");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearInterval(intervalId);
      unsubscribeMutation();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [
    convergenceGuardEnabled,
    maybePublishBackup,
    maybeRestoreBackup,
    params.privateKeyHex,
    params.publicKeyHex,
    snapshot.phase,
  ]);

  useEffect(() => {
    if (!params.publicKeyHex || !params.privateKeyHex || snapshot.phase !== "ready") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void maybeRestoreBackup("interval");
    }, ACTIVE_RESTORE_INTERVAL_MS);

    const followUpId = window.setTimeout(() => {
      void maybeRestoreBackup("follow_up");
    }, READY_RESTORE_FOLLOW_UP_DELAY_MS);

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        void maybeRestoreBackup("visible");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(followUpId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [maybeRestoreBackup, params.privateKeyHex, params.publicKeyHex, snapshot.phase]);

  return useMemo(() => ({
    snapshot,
    getAccountSyncSnapshot: accountSyncStatusStore.getSnapshot,
    publishEncryptedAccountBackup: async () => {
      if (!params.publicKeyHex || !params.privateKeyHex) {
        throw new Error("Identity is locked.");
      }
      const publishResult = await encryptedAccountBackupService.publishEncryptedAccountBackup({
        publicKeyHex: params.publicKeyHex,
        privateKeyHex: params.privateKeyHex,
        pool: params.pool,
        scopedRelayUrls: params.enabledRelayUrls,
      });
      if (wasBackupPublished(publishResult)) {
        lastBackupAtUnixMsRef.current = Date.now();
      }
      updateConvergenceDiagnostics({
        lastBackupPublishReason: "mutation",
        lastBackupPublishAttemptAtUnixMs: Date.now(),
        lastBackupPublishResult: mapPublishResult(publishResult),
      });
      return publishResult;
    },
  }), [params.enabledRelayUrls, params.pool, params.privateKeyHex, params.publicKeyHex, snapshot, updateConvergenceDiagnostics]);
};
