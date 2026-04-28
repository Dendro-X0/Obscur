import { beforeEach, describe, expect, it, vi } from "vitest";

const migrationPolicyMocks = vi.hoisted(() => ({
  getAccountSyncMigrationPolicy: vi.fn(),
}));

vi.mock("./account-sync-migration-policy", () => ({
  getAccountSyncMigrationPolicy: migrationPolicyMocks.getAccountSyncMigrationPolicy,
}));

import { resolveCanonicalBackupRestoreOwnerSelection } from "./restore-import-contracts";

describe("restore-import-contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps DM chat-state compatibility writes enabled before projection promotion", () => {
    migrationPolicyMocks.getAccountSyncMigrationPolicy.mockReturnValue({
      phase: "shadow",
      rollbackEnabled: true,
      updatedAtUnixMs: 1,
    });

    expect(resolveCanonicalBackupRestoreOwnerSelection({
      profileId: "default",
      accountPublicKeyHex: "a".repeat(64) as any,
    })).toEqual({
      migrationPhase: "shadow",
      restoreDmChatStateDomains: true,
      dmHistoryOwner: "chat_state_compatibility",
      reason: "projection_not_promoted",
    });
  });

  it("switches DM history ownership to canonical projection import in read cutover", () => {
    migrationPolicyMocks.getAccountSyncMigrationPolicy.mockReturnValue({
      phase: "read_cutover",
      rollbackEnabled: true,
      updatedAtUnixMs: 1,
    });

    expect(resolveCanonicalBackupRestoreOwnerSelection({
      profileId: "default",
      accountPublicKeyHex: "a".repeat(64) as any,
    })).toEqual({
      migrationPhase: "read_cutover",
      restoreDmChatStateDomains: true,
      dmHistoryOwner: "canonical_projection_import",
      reason: "projection_read_cutover",
    });
  });

  it("disables DM chat-state restore domains once legacy writes are disabled", () => {
    migrationPolicyMocks.getAccountSyncMigrationPolicy.mockReturnValue({
      phase: "legacy_writes_disabled",
      rollbackEnabled: false,
      updatedAtUnixMs: 1,
    });

    expect(resolveCanonicalBackupRestoreOwnerSelection({
      profileId: "default",
      accountPublicKeyHex: "a".repeat(64) as any,
    })).toEqual({
      migrationPhase: "legacy_writes_disabled",
      restoreDmChatStateDomains: false,
      dmHistoryOwner: "canonical_projection_import",
      reason: "projection_read_cutover",
    });
  });
});
