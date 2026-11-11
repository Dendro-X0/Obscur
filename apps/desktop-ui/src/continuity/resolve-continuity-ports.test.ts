import { describe, expect, it } from "vitest";
import { createLabContinuityPorts } from "./lab-continuity-ports";
import { resolveDesktopUiContinuityPorts } from "./resolve-continuity-ports";
import type { ContinuityPorts } from "./ports";

const fakeNative: ContinuityPorts = {
  getHonesty: () => "partial",
  getInventory: () => createLabContinuityPorts().getInventory(),
  exportSealedSnapshot: async () => ({
    ok: true,
    honesty: "partial",
    inventory: createLabContinuityPorts().getInventory(),
    serialized: "{}",
  }),
  importSealedSnapshot: async () => ({
    ok: true,
    honesty: "partial",
    inventory: createLabContinuityPorts().getInventory(),
  }),
  publishSealedSnapshotToHome: async () => ({
    ok: true,
    honesty: "partial",
    inventory: createLabContinuityPorts().getInventory(),
    homeBackupId: "cb-test",
  }),
  restoreSealedSnapshotFromHome: async () => ({
    ok: true,
    honesty: "partial",
    inventory: createLabContinuityPorts().getInventory(),
  }),
  createDeviceTransferOffer: async () => ({
    ok: true,
    honesty: "partial",
    inventory: createLabContinuityPorts().getInventory(),
    transferOfferJson: "{}",
    transferCode: "000000",
  }),
  acceptDeviceTransferOffer: async () => ({
    ok: true,
    honesty: "partial",
    inventory: createLabContinuityPorts().getInventory(),
  }),
  listLinkedDevices: () => [],
  enrollThisDevice: () => ({
    deviceId: "dev-1",
    label: "test",
    enrolledAtUnixMs: 1,
  }),
  revokeLinkedDevice: () => null,
  backfillFromPrivateHome: async () => ({
    ok: true,
    report: {
      profileId: "default",
      ranAtUnixMs: 1,
      conversationCount: 0,
      envelopeCount: 0,
      droppedPlaintextCount: 0,
      cursorUnixMs: 0,
      envelopeIds: [],
      honestyNote: "opaque_envelopes_only",
    },
  }),
  getLastHomeBackfillReport: () => null,
  createPeerHistoryGrant: () => ({ ok: false, reasonCode: "lab_stub" }),
  acceptPeerHistoryGrant: () => ({ ok: false, reasonCode: "lab_stub" }),
  listPeerHistoryGrants: () => [],
};

describe("resolveDesktopUiContinuityPorts (Cut 8.3)", () => {
  it("prefers native when host present and lab stubs not forced", () => {
    const resolved = resolveDesktopUiContinuityPorts({
      isNativeRuntime: true,
      forceLabStubs: false,
      labPorts: createLabContinuityPorts(),
      nativePorts: fakeNative,
    });
    expect(resolved.source).toBe("native");
    expect(resolved.ports).toBe(fakeNative);
  });

  it("uses lab when stubs forced", () => {
    const lab = createLabContinuityPorts();
    const resolved = resolveDesktopUiContinuityPorts({
      isNativeRuntime: true,
      forceLabStubs: true,
      labPorts: lab,
      nativePorts: fakeNative,
    });
    expect(resolved.source).toBe("lab");
    expect(resolved.ports).toBe(lab);
  });

  it("uses lab when host absent", () => {
    const lab = createLabContinuityPorts();
    const resolved = resolveDesktopUiContinuityPorts({
      isNativeRuntime: false,
      forceLabStubs: false,
      labPorts: lab,
      nativePorts: fakeNative,
    });
    expect(resolved.source).toBe("lab");
  });
});
