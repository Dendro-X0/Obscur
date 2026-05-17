import { describe, expect, it } from "vitest";
import {
  areAccountProjectionRuntimeSnapshotsEqual,
  areAccountSyncSnapshotsEqual,
} from "./store-snapshot-equality";

describe("store-snapshot-equality", () => {
  it("treats projection runtime snapshots as equal when only updatedAtUnixMs differs", () => {
    const projection = { lastSequence: 3 } as any;
    const previous = {
      profileId: "p1",
      accountPublicKeyHex: "a".repeat(64),
      projection,
      phase: "ready" as const,
      status: "ready" as const,
      accountProjectionReady: true,
      driftStatus: "clean" as const,
      updatedAtUnixMs: 1,
    };
    const next = {
      ...previous,
      updatedAtUnixMs: 99,
    };
    expect(areAccountProjectionRuntimeSnapshotsEqual(previous, next)).toBe(true);
  });

  it("detects account sync convergence diagnostic changes", () => {
    const base = {
      publicKeyHex: "a".repeat(64) as any,
      status: "identity_only" as const,
      portabilityStatus: "unknown" as const,
      phase: "ready" as const,
      message: "Idle",
      convergenceDiagnostics: {
        guardEnabled: true,
        lastBackupRestoreResult: "skipped_cooldown" as const,
      },
    };
    const unchanged = {
      ...base,
      convergenceDiagnostics: {
        guardEnabled: true,
        lastBackupRestoreResult: "skipped_cooldown" as const,
      },
    };
    const changed = {
      ...base,
      convergenceDiagnostics: {
        guardEnabled: true,
        lastBackupRestoreResult: "applied" as const,
      },
    };
    expect(areAccountSyncSnapshotsEqual(base, unchanged)).toBe(true);
    expect(areAccountSyncSnapshotsEqual(base, changed)).toBe(false);
  });
});
