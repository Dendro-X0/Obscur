import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Passphrase } from "@dweb/crypto/passphrase";
import {
  createVitePassphraseIdentity,
  getViteIdentityRecordStorageKey,
  readViteIdentityRecord,
} from "./auth/vite-passphrase-device-unlock";
import { createViteContinuityPorts } from "./continuity/vite-continuity-ports";
import { createLabPrivateTrustHomePorts } from "./private-trust/lab-private-trust-ports";
import {
  readVitePrivateDcSession,
  writeVitePrivateDcSession,
} from "./private-trust/vite-private-dc-session";
import {
  readViteSettingsResidue,
  writeViteSettingsResidue,
} from "./settings/vite-settings-residue";

/**
 * Remaster R2 — headless E2E path on Vite remaster face.
 * create → home → Settings T2 → Continuity M1 export/import → private_dc T3-face send.
 * ≠ Soft L3 Fixed · ≠ Continuity Pass.
 */

describe("Remaster R2 E2E path", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
  });

  it("runs create → home → settings → Continuity export/import → private_dc send face", async () => {
    const devicePassphrase = "remaster-device-pass" as Passphrase;
    const continuityPassphrase = "remaster-continuity-pass" as Passphrase;

    const created = await createVitePassphraseIdentity({
      profileId: "default",
      passphrase: devicePassphrase,
      username: "remaster",
    });
    expect(readViteIdentityRecord("default")?.publicKeyHex).toBe(created.publicKeyHex);

    writeVitePrivateDcSession("default", { baseUrl: "http://127.0.0.1:8791" });
    expect(readVitePrivateDcSession("default")?.baseUrl).toBe("http://127.0.0.1:8791");

    writeViteSettingsResidue("default", {
      displayName: "Remaster User",
      relayList: [{ url: "wss://relay.example", enabled: true }],
      privacySettings: { hideReadReceipts: true },
      uiSettings: { compact: true },
    });
    expect(readViteSettingsResidue("default").relayList).toHaveLength(1);

    const ports = createViteContinuityPorts({
      profileId: "default",
      downloadOnExport: false,
    });
    const exported = await ports.exportSealedSnapshot({
      continuityPassphrase,
      devicePassphrase,
    });
    expect(exported.ok).toBe(true);
    expect(exported.serialized).toBeTruthy();
    expect(exported.inventory.tiersPresent).toEqual(
      expect.arrayContaining(["T0", "T1", "T2"]),
    );

    window.localStorage.removeItem(getViteIdentityRecordStorageKey("default"));
    expect(readViteIdentityRecord("default")).toBeNull();

    const restored = await createViteContinuityPorts({
      profileId: "default",
      downloadOnExport: false,
    }).importSealedSnapshot(exported.serialized!, {
      continuityPassphrase,
    });
    expect(restored.ok).toBe(true);
    expect(readViteIdentityRecord("default")?.publicKeyHex.toLowerCase()).toBe(
      created.publicKeyHex.toLowerCase(),
    );
    expect(readViteSettingsResidue("default").displayName).toBe("Remaster User");
    expect(readViteSettingsResidue("default").relayList[0]?.url).toBe("wss://relay.example");

    const home = createLabPrivateTrustHomePorts({ preferPrivateDc: true });
    expect(home.resolveProtocolId()).toBe("private_dc");
    const conversationId = (await home.listConversations())[0]!.id;
    const sent = await home.sendDm({
      conversationId,
      body: "hello remaster",
      carrier: "private_dc",
    });
    expect(sent.ok).toBe(true);
    expect(sent.deliveryStatus).toBe("accepted");
  }, 60_000);
});
