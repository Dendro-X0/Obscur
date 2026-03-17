import { beforeEach, describe, expect, it } from "vitest";
import {
  getAccountSyncMigrationPolicy,
  setAccountSyncMigrationPolicy,
  setLegacyWritesDisabled,
  shouldReadProjectionContactsDm,
  shouldWriteLegacyContactsDm,
  type AccountSyncMigrationPolicy,
} from "./account-sync-migration-policy";

const policy = (phase: AccountSyncMigrationPolicy["phase"]): AccountSyncMigrationPolicy => ({
  phase,
  rollbackEnabled: true,
  updatedAtUnixMs: 1_000,
});

describe("account-sync-migration-policy", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads projections only in cutover phases", () => {
    expect(shouldReadProjectionContactsDm(policy("shadow"))).toBe(false);
    expect(shouldReadProjectionContactsDm(policy("drift_gate"))).toBe(false);
    expect(shouldReadProjectionContactsDm(policy("read_cutover"))).toBe(true);
    expect(shouldReadProjectionContactsDm(policy("legacy_writes_disabled"))).toBe(true);
  });

  it("disables legacy writes only after legacy_writes_disabled phase", () => {
    expect(shouldWriteLegacyContactsDm(policy("shadow"))).toBe(true);
    expect(shouldWriteLegacyContactsDm(policy("drift_gate"))).toBe(true);
    expect(shouldWriteLegacyContactsDm(policy("read_cutover"))).toBe(true);
    expect(shouldWriteLegacyContactsDm(policy("legacy_writes_disabled"))).toBe(false);
  });

  it("stores migration phase per profile/account scope", () => {
    setAccountSyncMigrationPolicy(
      { phase: "drift_gate" },
      { profileId: "profile-a", accountPublicKeyHex: "a".repeat(64) },
    );
    setAccountSyncMigrationPolicy(
      { phase: "read_cutover" },
      { profileId: "profile-b", accountPublicKeyHex: "b".repeat(64) },
    );

    expect(getAccountSyncMigrationPolicy({
      profileId: "profile-a",
      accountPublicKeyHex: "a".repeat(64),
    }).phase).toBe("drift_gate");
    expect(getAccountSyncMigrationPolicy({
      profileId: "profile-b",
      accountPublicKeyHex: "b".repeat(64),
    }).phase).toBe("read_cutover");
  });

  it("toggles legacy write disablement within a scoped partition", () => {
    setAccountSyncMigrationPolicy(
      { phase: "read_cutover" },
      { profileId: "profile-a", accountPublicKeyHex: "a".repeat(64) },
    );
    setLegacyWritesDisabled(
      true,
      { profileId: "profile-a", accountPublicKeyHex: "a".repeat(64) },
    );

    expect(getAccountSyncMigrationPolicy({
      profileId: "profile-a",
      accountPublicKeyHex: "a".repeat(64),
    }).phase).toBe("legacy_writes_disabled");
    expect(getAccountSyncMigrationPolicy({
      profileId: "profile-b",
      accountPublicKeyHex: "b".repeat(64),
    }).phase).toBe("shadow");
  });
});
