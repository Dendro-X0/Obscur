import { describe, expect, it } from "vitest";
import { encryptPrivateKeyHex } from "@dweb/crypto/encrypt-private-key-hex";
import { generatePrivateKeyHex } from "@dweb/crypto/generate-private-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { ViteIdentityRecord } from "../auth/vite-passphrase-device-unlock";
import type { ContinuityM1PeerTrust } from "./continuity-m1-snapshot";
import { createViteContinuityPorts } from "./vite-continuity-ports";

describe("vite Continuity M4 transfer ports (Cut 10.3)", () => {
  it("creates M4 offer and accepts into a wiped local store", async () => {
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
      writeIdentityRecord: (_id, record) => {
        storedIdentity = record;
      },
      writePeerTrust: (_pk, peerTrust) => {
        storedPeerTrust = peerTrust;
      },
      readHomeSession: () => null,
    });

    const offered = await ports.createDeviceTransferOffer({
      continuityPassphrase,
      devicePassphrase,
    });
    expect(offered.ok).toBe(true);
    expect(offered.transferCode).toMatch(/^\d{6}$/);
    expect(offered.transferOfferJson).toBeTruthy();

    storedIdentity = null;
    storedPeerTrust = { acceptedPeers: [], mutedPeers: [] };

    const accepted = await ports.acceptDeviceTransferOffer({
      continuityPassphrase,
      transferOfferJson: offered.transferOfferJson!,
      transferCode: offered.transferCode!,
    });
    expect(accepted.ok).toBe(true);
    expect(storedIdentity?.publicKeyHex).toBe(publicKeyHex);
    expect(storedPeerTrust.acceptedPeers).toEqual(["peer-a"]);
  }, 90_000);
});
