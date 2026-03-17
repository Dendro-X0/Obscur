import { describe, expect, it } from "vitest";
import type { AccountProjectionRuntimeSnapshot } from "../account-event-contracts";
import type { AccountSyncMigrationPolicy } from "./account-sync-migration-policy";
import { resolveProjectionReadAuthority } from "./account-projection-read-authority";

const createProjectionSnapshot = (overrides?: Partial<AccountProjectionRuntimeSnapshot>): AccountProjectionRuntimeSnapshot => ({
  profileId: "default",
  accountPublicKeyHex: "a".repeat(64) as any,
  projection: null,
  phase: "ready",
  status: "ready",
  accountProjectionReady: true,
  driftStatus: "clean",
  updatedAtUnixMs: 1_000,
  ...overrides,
});

const createPolicy = (phase: AccountSyncMigrationPolicy["phase"], rollbackEnabled = true): AccountSyncMigrationPolicy => ({
  phase,
  rollbackEnabled,
  updatedAtUnixMs: 1_000,
});

describe("resolveProjectionReadAuthority", () => {
  it("keeps reads on legacy in shadow mode", () => {
    const authority = resolveProjectionReadAuthority({
      projectionSnapshot: createProjectionSnapshot(),
      policy: createPolicy("shadow"),
    });
    expect(authority.useProjectionReads).toBe(false);
    expect(authority.reason).toBe("shadow_mode");
  });

  it("keeps reads on legacy in drift-gate phase", () => {
    const authority = resolveProjectionReadAuthority({
      projectionSnapshot: createProjectionSnapshot(),
      policy: createPolicy("drift_gate"),
    });
    expect(authority.useProjectionReads).toBe(false);
    expect(authority.reason).toBe("drift_gate_not_promoted");
  });

  it("enables projection reads at cutover when drift is clean", () => {
    const authority = resolveProjectionReadAuthority({
      projectionSnapshot: createProjectionSnapshot({
        driftReport: {
          criticalDriftCount: 0,
          nonCriticalDriftCount: 1,
          domains: ["contacts"],
          checkedAtUnixMs: 1_000,
        },
      }),
      policy: createPolicy("read_cutover"),
    });
    expect(authority.useProjectionReads).toBe(true);
    expect(authority.reason).toBe("read_cutover_enabled");
  });

  it("rolls reads back to legacy when critical drift exists and rollback is enabled", () => {
    const authority = resolveProjectionReadAuthority({
      projectionSnapshot: createProjectionSnapshot({
        driftStatus: "drifted",
        driftReport: {
          criticalDriftCount: 2,
          nonCriticalDriftCount: 0,
          domains: ["contacts"],
          checkedAtUnixMs: 1_000,
        },
      }),
      policy: createPolicy("read_cutover", true),
    });
    expect(authority.useProjectionReads).toBe(false);
    expect(authority.reason).toBe("rollback_on_critical_drift");
    expect(authority.criticalDriftCount).toBe(2);
  });

  it("keeps projection reads enabled when rollback is disabled", () => {
    const authority = resolveProjectionReadAuthority({
      projectionSnapshot: createProjectionSnapshot({
        driftStatus: "drifted",
        driftReport: {
          criticalDriftCount: 1,
          nonCriticalDriftCount: 0,
          domains: ["contacts"],
          checkedAtUnixMs: 1_000,
        },
      }),
      policy: createPolicy("legacy_writes_disabled", false),
    });
    expect(authority.useProjectionReads).toBe(true);
    expect(authority.reason).toBe("read_cutover_enabled");
  });

  it("keeps projection reads enabled in legacy_writes_disabled even when drift exists", () => {
    const authority = resolveProjectionReadAuthority({
      projectionSnapshot: createProjectionSnapshot({
        driftStatus: "drifted",
        driftReport: {
          criticalDriftCount: 3,
          nonCriticalDriftCount: 1,
          domains: ["contacts", "messages"],
          checkedAtUnixMs: 1_000,
        },
      }),
      policy: createPolicy("legacy_writes_disabled", true),
    });
    expect(authority.useProjectionReads).toBe(true);
    expect(authority.reason).toBe("read_cutover_enabled");
    expect(authority.criticalDriftCount).toBe(3);
  });
});
