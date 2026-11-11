import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { createDelegatingDeviceUnlockPort } from "@obscur/auth-engine";
import {
  createVitePassphraseDeviceUnlockHandlers,
  type ViteIdentityRecord,
} from "./vite-passphrase-device-unlock";

const hex = "ab".repeat(32) as PublicKeyHex;

vi.mock("@dweb/crypto/decrypt-private-key-hex", () => ({
  decryptPrivateKeyHex: vi.fn(async ({ passphrase }: { passphrase: string }) => {
    if (passphrase !== "correct-horse") {
      throw new Error("decrypt failed");
    }
    return "cd".repeat(32);
  }),
}));

vi.mock("@dweb/crypto/derive-public-key-hex", () => ({
  derivePublicKeyHex: vi.fn(() => hex),
}));

describe("Cut 4.4 vite passphrase device unlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unlocks when passphrase matches stored identity", async () => {
    const record: ViteIdentityRecord = {
      encryptedPrivateKey: "encrypted",
      publicKeyHex: hex,
    };
    const port = createDelegatingDeviceUnlockPort(
      createVitePassphraseDeviceUnlockHandlers({
        readIdentityRecord: () => record,
      }),
    );
    const ok = await port.unlockWithPassphrase({
      profileId: "lab",
      passphrase: "correct-horse" as Passphrase,
      expectedPublicKeyHex: hex,
      context: "unlock",
    });
    expect(ok.status).toBe("ok");
    expect(ok.value?.publicKeyHex).toBe(hex);

    const bad = await port.unlockWithPassphrase({
      profileId: "lab",
      passphrase: "wrong" as Passphrase,
      expectedPublicKeyHex: hex,
      context: "unlock",
    });
    expect(bad.status).toBe("failed");
    expect(bad.reasonCode).toBe("invalid_passphrase");
  });

  it("fails closed when identity material missing", async () => {
    const port = createDelegatingDeviceUnlockPort(
      createVitePassphraseDeviceUnlockHandlers({
        readIdentityRecord: () => null,
      }),
    );
    const result = await port.unlockWithPassphrase({
      profileId: "lab",
      passphrase: "x" as Passphrase,
      expectedPublicKeyHex: hex,
      context: "unlock",
    });
    expect(result.status).toBe("failed");
    expect(result.reasonCode).toBe("invalid_input");
  });
});
