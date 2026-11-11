import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Passphrase } from "@dweb/crypto/passphrase";

vi.mock("@dweb/crypto/generate-private-key-hex", () => ({
  generatePrivateKeyHex: vi.fn(() => "ab".repeat(32)),
}));

vi.mock("@dweb/crypto/derive-public-key-hex", () => ({
  derivePublicKeyHex: vi.fn(() => "cd".repeat(32)),
}));

vi.mock("@dweb/crypto/encrypt-private-key-hex", () => ({
  encryptPrivateKeyHex: vi.fn(async () => "encrypted-blob"),
}));

describe("createVitePassphraseIdentity (Cut 11.1)", () => {
  beforeEach(() => {
    vi.resetModules();
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

  it("creates and stores passphrase-wrapped identity", async () => {
    const { createVitePassphraseIdentity, readViteIdentityRecord } = await import(
      "./vite-passphrase-device-unlock"
    );
    const record = await createVitePassphraseIdentity({
      profileId: "default",
      passphrase: "long-enough-pass" as Passphrase,
      username: "alice",
    });
    expect(record.publicKeyHex).toBe("cd".repeat(32));
    expect(record.encryptedPrivateKey).toBe("encrypted-blob");
    expect(readViteIdentityRecord("default")?.username).toBe("alice");
  });

  it("refuses short passphrase", async () => {
    const { createVitePassphraseIdentity } = await import("./vite-passphrase-device-unlock");
    await expect(createVitePassphraseIdentity({
      profileId: "default",
      passphrase: "short" as Passphrase,
    })).rejects.toThrow(/at least 8/i);
  });
});
