import { describe, expect, it } from "vitest";
import { createLabContinuityPorts } from "./lab-continuity-ports";

describe("lab-continuity-ports (Cut 7.4)", () => {
  it("reports partial honesty for C0 T0–T2 lab fields", () => {
    const ports = createLabContinuityPorts();
    expect(ports.getHonesty()).toBe("partial");
    expect(ports.getInventory().missingRequiredTiers).toEqual([]);
  });

  it("refuses real export/import/home in lab stub", async () => {
    const ports = createLabContinuityPorts();
    const exported = await ports.exportSealedSnapshot({ continuityPassphrase: "x" });
    const imported = await ports.importSealedSnapshot("{}", { continuityPassphrase: "x" });
    const published = await ports.publishSealedSnapshotToHome({ continuityPassphrase: "x" });
    const restored = await ports.restoreSealedSnapshotFromHome({ continuityPassphrase: "x" });
    const offered = await ports.createDeviceTransferOffer({ continuityPassphrase: "x" });
    const accepted = await ports.acceptDeviceTransferOffer({
      continuityPassphrase: "x",
      transferOfferJson: "{}",
      transferCode: "000000",
    });
    expect(exported.ok).toBe(false);
    expect(exported.reasonCode).toBe("lab_stub");
    expect(imported.ok).toBe(false);
    expect(imported.reasonCode).toBe("lab_stub");
    expect(published.reasonCode).toBe("lab_stub");
    expect(restored.reasonCode).toBe("lab_stub");
    expect(offered.reasonCode).toBe("lab_stub");
    expect(accepted.reasonCode).toBe("lab_stub");
    expect(ports.listLinkedDevices()).toEqual([]);
    expect(ports.revokeLinkedDevice("x")).toBeNull();
    const backfilled = await ports.backfillFromPrivateHome();
    expect(backfilled.ok).toBe(false);
    expect(ports.getLastHomeBackfillReport()).toBeNull();
    expect(ports.createPeerHistoryGrant({ recipientPublicKeyHex: "aa".repeat(16) }).ok).toBe(false);
    expect(ports.listPeerHistoryGrants()).toEqual([]);
    expect(exported.error).toContain("≠ Continuity Pass");
  });
});
