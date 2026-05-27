import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import {
  accountSyncMigrationPolicyInternals,
  getAccountSyncMigrationPolicy,
  setAccountSyncMigrationPolicy,
} from "./account-sync-migration-policy";

describe("account-sync-migration-policy native (P3c)", () => {
  afterEach(() => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    window.localStorage.removeItem(accountSyncMigrationPolicyInternals.STORAGE_KEY);
  });

  it("forces legacy_writes_disabled on native even when store says shadow", () => {
    setAccountSyncMigrationPolicy({ phase: "shadow" });
    const policy = getAccountSyncMigrationPolicy();
    expect(policy.phase).toBe("legacy_writes_disabled");
    expect(policy.rollbackEnabled).toBe(false);
  });
});
