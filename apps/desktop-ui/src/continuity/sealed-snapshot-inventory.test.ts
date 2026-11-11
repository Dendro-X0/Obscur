import { describe, expect, it } from "vitest";
import {
  SEALED_SNAPSHOT_CORE_FIELDS,
  SEALED_SNAPSHOT_FIELD_TIER,
  inventorySealedSnapshotFields,
  sealedSnapshotMeetsC0RequiredTiers,
} from "./sealed-snapshot-inventory";

describe("sealed-snapshot-inventory (Cut 7.2)", () => {
  it("maps T0–T3 fields and leaves T4 out of band for payload v1", () => {
    expect(SEALED_SNAPSHOT_FIELD_TIER.identityUnlock).toBe("T0");
    expect(SEALED_SNAPSHOT_FIELD_TIER.peerTrust).toBe("T1");
    expect(SEALED_SNAPSHOT_FIELD_TIER.relayList).toBe("T2");
    expect(SEALED_SNAPSHOT_FIELD_TIER.chatState).toBe("T3");
    expect(SEALED_SNAPSHOT_FIELD_TIER.nativeSqliteEvidence).toBe("T3");
    expect(SEALED_SNAPSHOT_CORE_FIELDS.includes("vaultMedia" as never)).toBe(false);
  });

  it("classifies C0-complete without T3/T4 as partial (honest)", () => {
    const inventory = inventorySealedSnapshotFields([
      "publicKeyHex",
      "identityUnlock",
      "profile",
      "peerTrust",
      "requestFlowEvidence",
      "requestOutbox",
      "privacySettings",
      "relayList",
      "uiSettings",
      "syncCheckpoints",
    ]);
    expect(sealedSnapshotMeetsC0RequiredTiers(inventory)).toBe(true);
    expect(inventory.honesty).toBe("partial");
    expect(inventory.t3Present).toBe(false);
    expect(inventory.t4Present).toBe(false);
  });

  it("classifies empty when no recognized fields", () => {
    const inventory = inventorySealedSnapshotFields([]);
    expect(inventory.honesty).toBe("empty");
    expect(inventory.missingRequiredTiers).toEqual(["T0", "T1", "T2"]);
  });

  it("marks restoring when in-flight", () => {
    expect(inventorySealedSnapshotFields(["peerTrust"], { restoring: true }).honesty).toBe(
      "restoring",
    );
  });

  it("needs T3+T4 for full honesty (C0 rarely full)", () => {
    const inventory = inventorySealedSnapshotFields([
      "publicKeyHex",
      "profile",
      "peerTrust",
      "privacySettings",
      "relayList",
      "chatState",
      "nativeSqliteEvidence",
    ]);
    // Still missing T4 → partial
    expect(inventory.honesty).toBe("partial");
    expect(inventory.t3Present).toBe(true);
  });
});
