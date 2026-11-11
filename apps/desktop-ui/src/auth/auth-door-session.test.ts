import { describe, expect, it } from "vitest";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  applyAuthDoorUnlockSuccess,
  createLockedAuthDoorSession,
  clearAuthDoorBindPending,
  isAuthDoorShellReady,
  unlockAuthDoorWithPassphrase,
} from "./auth-door-session";
import { createLabDeviceUnlockPort, LAB_AUTH_DOOR_DEFAULTS } from "./lab-device-unlock-port";

const hex = LAB_AUTH_DOOR_DEFAULTS.expectedPublicKeyHex;

describe("Cut 3.2 auth-door-session unlock→shell-ready", () => {
  it("stays closed while device-password bind is pending", () => {
    const locked = createLockedAuthDoorSession({
      profileId: "lab",
      expectedPublicKeyHex: hex,
    });
    const pending = applyAuthDoorUnlockSuccess(locked, {
      publicKeyHex: hex,
      devicePasswordBindPending: true,
    });
    expect(pending.phase).toBe("bind_pending");
    expect(isAuthDoorShellReady(pending)).toBe(false);

    const ready = clearAuthDoorBindPending(pending);
    expect(ready.phase).toBe("shell_ready");
    expect(isAuthDoorShellReady(ready)).toBe(true);
  });

  it("reaches shell-ready through DeviceUnlockPort passphrase unlock", async () => {
    const port = createLabDeviceUnlockPort({
      acceptedPassphrase: LAB_AUTH_DOOR_DEFAULTS.acceptedPassphrase,
      publicKeyHex: hex,
    });
    const locked = createLockedAuthDoorSession({
      profileId: LAB_AUTH_DOOR_DEFAULTS.profileId,
      expectedPublicKeyHex: hex,
    });
    const next = await unlockAuthDoorWithPassphrase({
      session: locked,
      deviceUnlock: port,
      passphrase: LAB_AUTH_DOOR_DEFAULTS.acceptedPassphrase as Passphrase,
    });
    expect(next.phase).toBe("shell_ready");
    expect(next.publicKeyHex).toBe(hex);
    expect(isAuthDoorShellReady(next)).toBe(true);
  });

  it("rejects wrong passphrase without inventing unlock", async () => {
    const port = createLabDeviceUnlockPort({
      acceptedPassphrase: LAB_AUTH_DOOR_DEFAULTS.acceptedPassphrase,
      publicKeyHex: hex,
    });
    const locked = createLockedAuthDoorSession({
      profileId: LAB_AUTH_DOOR_DEFAULTS.profileId,
      expectedPublicKeyHex: hex as PublicKeyHex,
    });
    const next = await unlockAuthDoorWithPassphrase({
      session: locked,
      deviceUnlock: port,
      passphrase: "wrong" as Passphrase,
    });
    expect(next.phase).toBe("error");
    expect(isAuthDoorShellReady(next)).toBe(false);
  });
});
