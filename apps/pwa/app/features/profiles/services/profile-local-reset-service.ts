"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { dbWipeProfileLocalData } from "@dweb/db";
import { clearOperatorTrustConfig } from "@/app/features/groups/services/operator-trust-config";
import { clearBlocklistStorage } from "@/app/features/messaging/lib/dms/use-blocklist";
import {
  resetLocalHistoryKeepingIdentity,
  type LocalHistoryResetReport,
} from "@/app/features/messaging/services/local-history-reset-service";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { getResolvedProfileId } from "./profile-runtime-scope";

export type ProfileLocalResetTier = "caches_only" | "complete";

export type ProfileLocalResetReport = Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex | null;
  tier: ProfileLocalResetTier;
  historyReset: LocalHistoryResetReport;
  sqliteWiped: boolean;
  sqliteRowsDeleted: number;
  operatorConfigCleared: boolean;
  webviewDataCleared: boolean;
  blocklistCleared: boolean;
  warnings: ReadonlyArray<string>;
}>;

const wipeNativeProfileSqlite = async (
  profileId: string,
  removeProfileRow: boolean,
  warnings: string[],
): Promise<Readonly<{ wiped: boolean; rowsDeleted: number }>> => {
  if (!requiresSqlitePersistence()) {
    return { wiped: false, rowsDeleted: 0 };
  }
  try {
    const report = await dbWipeProfileLocalData(profileId, removeProfileRow);
    return { wiped: true, rowsDeleted: report.rows_deleted };
  } catch (error) {
    warnings.push(`Native SQLite wipe failed: ${error instanceof Error ? error.message : String(error)}`);
    return { wiped: false, rowsDeleted: 0 };
  }
};

const clearNativeProfileWebviewData = async (
  profileId: string,
  warnings: string[],
): Promise<boolean> => {
  const result = await invokeNativeCommand<void>("desktop_clear_profile_webview_data", { profileId });
  if (!result.ok) {
    warnings.push(`Native WebView data clear failed: ${result.message ?? result.reason ?? "unknown"}`);
    return false;
  }
  return true;
};

/** Tier 1 — clear local caches/history and operator endpoints; keep sign-in. */
export const clearProfileLocalCachesKeepingIdentity = async (
  params?: Readonly<{
    profileId?: string;
    publicKeyHex?: string | PublicKeyHex | null;
  }>,
): Promise<ProfileLocalResetReport> => {
  const profileId = params?.profileId?.trim() || getResolvedProfileId();
  const publicKeyHex = normalizePublicKeyHex(params?.publicKeyHex ?? undefined);
  const warnings: string[] = [];

  const historyReset = await resetLocalHistoryKeepingIdentity({
    profileId,
    publicKeyHex,
  });
  warnings.push(...historyReset.warnings);

  clearOperatorTrustConfig();

  const sqlite = await wipeNativeProfileSqlite(profileId, false, warnings);

  return {
    profileId,
    publicKeyHex: historyReset.publicKeyHex,
    tier: "caches_only",
    historyReset,
    sqliteWiped: sqlite.wiped,
    sqliteRowsDeleted: sqlite.rowsDeleted,
    operatorConfigCleared: true,
    webviewDataCleared: false,
    blocklistCleared: false,
    warnings,
  };
};

/** Tier 2 — full local removal for a profile slot (before identity forget in settings flow). */
export const completeProfileLocalDataRemoval = async (
  params: Readonly<{
    profileId: string;
    publicKeyHex?: string | PublicKeyHex | null;
  }>,
): Promise<ProfileLocalResetReport> => {
  const profileId = params.profileId.trim();
  const publicKeyHex = normalizePublicKeyHex(params.publicKeyHex ?? undefined);
  const warnings: string[] = [];

  const historyReset = await resetLocalHistoryKeepingIdentity({
    profileId,
    publicKeyHex,
  });
  warnings.push(...historyReset.warnings);

  clearOperatorTrustConfig();

  let blocklistCleared = false;
  if (publicKeyHex) {
    try {
      clearBlocklistStorage(publicKeyHex);
      blocklistCleared = true;
    } catch (error) {
      warnings.push(`Blocklist clear failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const webviewDataCleared = await clearNativeProfileWebviewData(profileId, warnings);
  const sqlite = await wipeNativeProfileSqlite(profileId, true, warnings);

  return {
    profileId,
    publicKeyHex: historyReset.publicKeyHex,
    tier: "complete",
    historyReset,
    sqliteWiped: sqlite.wiped,
    sqliteRowsDeleted: sqlite.rowsDeleted,
    operatorConfigCleared: true,
    webviewDataCleared,
    blocklistCleared,
    warnings,
  };
};
