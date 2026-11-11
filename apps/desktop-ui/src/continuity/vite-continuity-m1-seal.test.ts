import { describe, expect, it } from "vitest";
import { encryptPrivateKeyHex } from "@dweb/crypto/encrypt-private-key-hex";
import { generatePrivateKeyHex } from "@dweb/crypto/generate-private-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import {
  CONTINUITY_M1_SNAPSHOT_FORMAT,
  presentContinuityM1FieldNames,
  type ContinuityM1Snapshot,
} from "./continuity-m1-snapshot";
import { inventorySealedSnapshotFields } from "./sealed-snapshot-inventory";
import {
  sealContinuityM1Snapshot,
  serializeContinuityM1SealedEnvelope,
  unsealContinuityM1Snapshot,
} from "./vite-continuity-m1-seal";

describe("vite-continuity-m1-seal (Cut 8.1)", () => {
  it("round-trips Continuity M1 snapshot with Continuity passphrase", async () => {
    const privateKeyHex = generatePrivateKeyHex();
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    const continuityPassphrase = "continuity-pass-cut8";
    const encryptedPrivateKey = await encryptPrivateKeyHex({
      privateKeyHex,
      passphrase: continuityPassphrase,
    });
    const snapshot: ContinuityM1Snapshot = {
      version: 1,
      format: CONTINUITY_M1_SNAPSHOT_FORMAT,
      createdAtUnixMs: 1_700_000_000_000,
      publicKeyHex,
      identityUnlock: { encryptedPrivateKey, username: "tester" },
      profile: { username: "tester" },
      peerTrust: { acceptedPeers: [publicKeyHex], mutedPeers: [] },
      privacySettings: {},
      relayList: [],
      uiSettings: {},
    };

    const inventory = inventorySealedSnapshotFields(presentContinuityM1FieldNames(snapshot));
    expect(inventory.missingRequiredTiers).toEqual([]);
    expect(inventory.honesty).toBe("partial");

    const envelope = await sealContinuityM1Snapshot({ snapshot, continuityPassphrase });
    const serialized = serializeContinuityM1SealedEnvelope(envelope);
    const restored = await unsealContinuityM1Snapshot({
      envelope: serialized,
      continuityPassphrase,
    });
    expect(restored.publicKeyHex).toBe(publicKeyHex);
    expect(restored.peerTrust.acceptedPeers).toEqual([publicKeyHex]);
    expect(restored.identityUnlock.encryptedPrivateKey).toBe(encryptedPrivateKey);
  }, 60_000);

  it("refuses wrong Continuity passphrase", async () => {
    const privateKeyHex = generatePrivateKeyHex();
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    const encryptedPrivateKey = await encryptPrivateKeyHex({
      privateKeyHex,
      passphrase: "right-pass",
    });
    const snapshot: ContinuityM1Snapshot = {
      version: 1,
      format: CONTINUITY_M1_SNAPSHOT_FORMAT,
      createdAtUnixMs: Date.now(),
      publicKeyHex,
      identityUnlock: { encryptedPrivateKey },
      profile: {},
      peerTrust: { acceptedPeers: [], mutedPeers: [] },
      privacySettings: {},
      relayList: [],
      uiSettings: {},
    };
    const envelope = await sealContinuityM1Snapshot({
      snapshot,
      continuityPassphrase: "right-pass",
    });
    await expect(unsealContinuityM1Snapshot({
      envelope,
      continuityPassphrase: "wrong-pass",
    })).rejects.toThrow(/Incorrect Continuity passphrase|corrupt/i);
  }, 60_000);
});
