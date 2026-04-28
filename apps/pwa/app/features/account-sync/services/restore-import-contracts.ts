import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  getAccountSyncMigrationPolicy,
  type AccountSyncMigrationPhase,
} from "./account-sync-migration-policy";

export type CanonicalBackupRestoreDmHistoryOwner =
  | "chat_state_compatibility"
  | "canonical_projection_import";

export type CanonicalBackupRestoreDmHistoryOwnerReason =
  | "projection_not_promoted"
  | "projection_read_cutover";

export type CanonicalBackupRestoreOwnerSelection = Readonly<{
  migrationPhase: AccountSyncMigrationPhase;
  restoreDmChatStateDomains: boolean;
  dmHistoryOwner: CanonicalBackupRestoreDmHistoryOwner;
  reason: CanonicalBackupRestoreDmHistoryOwnerReason;
}>;

export const resolveCanonicalBackupRestoreOwnerSelection = (params: Readonly<{
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
}>): CanonicalBackupRestoreOwnerSelection => {
  const migrationPolicy = getAccountSyncMigrationPolicy({
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
  });
  const projectionOwnsDmHistory = (
    migrationPolicy.phase === "read_cutover"
    || migrationPolicy.phase === "legacy_writes_disabled"
  );
  return projectionOwnsDmHistory
    ? {
      migrationPhase: migrationPolicy.phase,
      restoreDmChatStateDomains: migrationPolicy.phase !== "legacy_writes_disabled",
      dmHistoryOwner: "canonical_projection_import",
      reason: "projection_read_cutover",
    }
    : {
      migrationPhase: migrationPolicy.phase,
      restoreDmChatStateDomains: true,
      dmHistoryOwner: "chat_state_compatibility",
      reason: "projection_not_promoted",
    };
};
