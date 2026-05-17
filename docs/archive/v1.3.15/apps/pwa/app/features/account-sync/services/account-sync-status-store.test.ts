import { describe, expect, it } from "vitest";
import { accountSyncStatusStoreInternals } from "./account-sync-status-store";

describe("accountSyncStatusStore", () => {
  it("marks account portable only when profile and backup proofs both have relay evidence", () => {
    expect(accountSyncStatusStoreInternals.derivePortabilityStatus({
      publicKeyHex: "f".repeat(64) as any,
      status: "private_restored",
      portabilityStatus: "unknown",
      phase: "ready",
      message: "ready",
      profileProof: {
        deliveryStatus: "sent_quorum",
        updatedAtUnixMs: Date.now(),
      },
      backupProof: {
        deliveryStatus: "sent_partial",
        updatedAtUnixMs: Date.now(),
      },
    })).toBe("portable");
  });

  it("marks account profile_only when backup proof is missing", () => {
    expect(accountSyncStatusStoreInternals.derivePortabilityStatus({
      publicKeyHex: "f".repeat(64) as any,
      status: "public_restored",
      portabilityStatus: "unknown",
      phase: "ready",
      message: "ready",
      profileProof: {
        deliveryStatus: "sent_quorum",
        updatedAtUnixMs: Date.now(),
      },
    })).toBe("profile_only");
  });

  it("marks account local_only when proof is queued or failed", () => {
    expect(accountSyncStatusStoreInternals.derivePortabilityStatus({
      publicKeyHex: "f".repeat(64) as any,
      status: "identity_only",
      portabilityStatus: "unknown",
      phase: "ready",
      message: "ready",
      profileProof: {
        deliveryStatus: "queued",
        updatedAtUnixMs: Date.now(),
      },
    })).toBe("local_only");
  });
});
