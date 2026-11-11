import { describe, expect, it, vi } from "vitest";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  createDelegatingDeviceUnlockPort,
  createUnavailableDeviceUnlockPort,
  mapDeviceUnlockFailure,
} from "./device-unlock-adapter";

const hex = "d".repeat(64) as PublicKeyHex;

describe("Cut 4.1 device-unlock-adapter", () => {
  it("delegates passphrase unlock and maps handler success", async () => {
    const unlockWithPassphrase = vi.fn(async () => ({
      profileId: "tester1",
      publicKeyHex: hex,
      staySignedInApplied: true,
    }));
    const port = createDelegatingDeviceUnlockPort({
      unlockWithPassphrase,
      unlockWithPrivateKey: async () => {
        throw new Error("unused");
      },
      revokeDeviceUnlockMaterial: async () => undefined,
    });
    const result = await port.unlockWithPassphrase({
      profileId: "tester1",
      passphrase: "secret" as Passphrase,
      expectedPublicKeyHex: hex,
      context: "unlock",
    });
    expect(result.status).toBe("ok");
    expect(result.value?.publicKeyHex).toBe(hex);
    expect(unlockWithPassphrase).toHaveBeenCalledOnce();
  });

  it("maps passphrase failures", () => {
    expect(mapDeviceUnlockFailure(new Error("Incorrect password")).reasonCode).toBe(
      "invalid_passphrase",
    );
    expect(mapDeviceUnlockFailure(new Error("Unknown command")).reasonCode).toBe(
      "unsupported_runtime",
    );
  });

  it("unavailable port fails closed", async () => {
    const port = createUnavailableDeviceUnlockPort();
    const result = await port.unlockWithPassphrase({
      profileId: "tester1",
      passphrase: "x" as Passphrase,
      expectedPublicKeyHex: hex,
      context: "unlock",
    });
    expect(result.status).toBe("failed");
    expect(result.reasonCode).toBe("unsupported_runtime");
  });
});
