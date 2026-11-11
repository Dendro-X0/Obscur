import { describe, expect, it } from "vitest";
import { encryptPrivateKeyHex } from "@dweb/crypto/encrypt-private-key-hex";
import { generatePrivateKeyHex } from "@dweb/crypto/generate-private-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { ViteIdentityRecord } from "../auth/vite-passphrase-device-unlock";
import type { ContinuityM1PeerTrust } from "./continuity-m1-snapshot";
import { createViteContinuityPorts } from "./vite-continuity-ports";

describe("vite-continuity-ports (Cut 8.2)", () => {
  it("exports and imports sealed Continuity M1 without pwa imports", async () => {
    const privateKeyHex = generatePrivateKeyHex();
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    const devicePassphrase = "device-pass";
    const continuityPassphrase = "continuity-pass";
    const encryptedPrivateKey = await encryptPrivateKeyHex({
      privateKeyHex,
      passphrase: devicePassphrase,
    });

    let storedIdentity: ViteIdentityRecord | null = {
      encryptedPrivateKey,
      publicKeyHex,
      username: "alice",
    };
    let storedPeerTrust: ContinuityM1PeerTrust = {
      acceptedPeers: ["peer-a"],
      mutedPeers: [],
    };

    const ports = createViteContinuityPorts({
      profileId: "default",
      downloadOnExport: false,
      readIdentityRecord: () => storedIdentity,
      readPeerTrust: () => storedPeerTrust,
      writeIdentityRecord: (_profileId, record) => {
        storedIdentity = record;
      },
      writePeerTrust: (_pubkey, peerTrust) => {
        storedPeerTrust = peerTrust;
      },
    });

    expect(ports.getInventory().missingRequiredTiers).toEqual([]);

    const exported = await ports.exportSealedSnapshot({
      continuityPassphrase,
      devicePassphrase,
    });
    expect(exported.ok).toBe(true);
    expect(exported.serialized).toBeTruthy();
    expect(exported.honesty).toBe("partial");

    storedIdentity = null;
    storedPeerTrust = { acceptedPeers: [], mutedPeers: [] };

    const imported = await ports.importSealedSnapshot(exported.serialized!, {
      continuityPassphrase,
    });
    expect(imported.ok).toBe(true);
    expect(storedIdentity?.publicKeyHex).toBe(publicKeyHex);
    expect(storedPeerTrust.acceptedPeers).toEqual(["peer-a"]);
  }, 90_000);

  it("refuses export without Continuity passphrase", async () => {
    const ports = createViteContinuityPorts({
      profileId: "default",
      downloadOnExport: false,
      readIdentityRecord: () => null,
    });
    const result = await ports.exportSealedSnapshot({ continuityPassphrase: "" });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe("missing_passphrase");
  });
});
