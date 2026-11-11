import { describe, expect, it, vi } from "vitest";
import { encryptPrivateKeyHex } from "@dweb/crypto/encrypt-private-key-hex";
import { generatePrivateKeyHex } from "@dweb/crypto/generate-private-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { ViteIdentityRecord } from "../auth/vite-passphrase-device-unlock";
import type { ContinuityM1PeerTrust } from "./continuity-m1-snapshot";
import { createViteContinuityPorts } from "./vite-continuity-ports";

describe("vite Continuity M2 home ports (Cut 9.3)", () => {
  it("publishes sealed Continuity to home and restores", async () => {
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
    let storedSealed: string | null = null;

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/v1/continuity/backups/latest")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({
            backup: storedSealed
              ? {
                id: "cb-restored",
                publicKeyHexHint: publicKeyHex.toLowerCase(),
                sealedEnvelopeJson: storedSealed,
                acceptedAtUnixMs: 1,
              }
              : null,
          }),
        };
      }
      if (url.includes("/v1/continuity/backups") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { sealedEnvelopeJson: string };
        storedSealed = body.sealedEnvelopeJson;
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({
            backup: {
              id: "cb-pub",
              publicKeyHexHint: publicKeyHex.toLowerCase(),
              acceptedAtUnixMs: 2,
              status: "accepted",
            },
          }),
        };
      }
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => JSON.stringify({ error: "not_found" }),
      };
    }) as unknown as typeof fetch;

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
      readHomeSession: () => ({ baseUrl: "http://127.0.0.1:8791" }),
      fetchImpl,
    });

    const published = await ports.publishSealedSnapshotToHome({
      continuityPassphrase,
      devicePassphrase,
    });
    expect(published.ok).toBe(true);
    expect(published.homeBackupId).toBe("cb-pub");
    expect(storedSealed).toBeTruthy();

    storedIdentity = null;
    storedPeerTrust = { acceptedPeers: [], mutedPeers: [] };

    const restored = await ports.restoreSealedSnapshotFromHome({
      continuityPassphrase,
      publicKeyHexHint: publicKeyHex,
    });
    expect(restored.ok).toBe(true);
    expect(storedIdentity?.publicKeyHex).toBe(publicKeyHex);
    expect(storedPeerTrust.acceptedPeers).toEqual(["peer-a"]);
  }, 90_000);

  it("refuses M2 publish when home session missing", async () => {
    const ports = createViteContinuityPorts({
      profileId: "default",
      downloadOnExport: false,
      readIdentityRecord: () => null,
      readHomeSession: () => null,
    });
    const result = await ports.publishSealedSnapshotToHome({
      continuityPassphrase: "x",
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe("home_unavailable");
  });
});
