import { describe, expect, it } from "vitest";
import type { DeviceUnlockPort } from "@dweb/auth/ports/device-unlock-port";
import { createLabDeviceUnlockPort, LAB_AUTH_DOOR_DEFAULTS } from "./lab-device-unlock-port";
import {
  readDesktopUiLabStubsForced,
  resolveDesktopUiDeviceUnlockPort,
} from "./resolve-device-unlock-port";
import { createViteNativeDeviceUnlockPort } from "./vite-native-device-unlock";

const lab = createLabDeviceUnlockPort({
  acceptedPassphrase: LAB_AUTH_DOOR_DEFAULTS.acceptedPassphrase,
  publicKeyHex: LAB_AUTH_DOOR_DEFAULTS.expectedPublicKeyHex,
});
const native = createViteNativeDeviceUnlockPort();

describe("Cut 4.3 resolveDesktopUiDeviceUnlockPort", () => {
  it("prefers lab when stubs forced", () => {
    const resolved = resolveDesktopUiDeviceUnlockPort({
      isNativeRuntime: true,
      forceLabStubs: true,
      labPort: lab,
      nativePort: native,
    });
    expect(resolved.source).toBe("lab");
    expect(resolved.port).toBe(lab);
  });

  it("prefers lab when host absent", () => {
    const resolved = resolveDesktopUiDeviceUnlockPort({
      isNativeRuntime: false,
      labPort: lab,
      nativePort: native,
    });
    expect(resolved.source).toBe("lab");
  });

  it("prefers native when Tauri present and stubs off", () => {
    const resolved = resolveDesktopUiDeviceUnlockPort({
      isNativeRuntime: true,
      forceLabStubs: false,
      labPort: lab,
      nativePort: native,
    });
    expect(resolved.source).toBe("native");
    expect(resolved.port).toBe(native);
  });

  it("reads OBSCUR_DESKTOP_UI_LAB_STUBS=1 as forced", () => {
    expect(readDesktopUiLabStubsForced("1")).toBe(true);
    expect(readDesktopUiLabStubsForced("0")).toBe(false);
    expect(readDesktopUiLabStubsForced(undefined)).toBe(false);
  });

  it("native port without handlers fails closed as DeviceUnlockPort", async () => {
    const port: DeviceUnlockPort = createViteNativeDeviceUnlockPort();
    const result = await port.unlockWithPassphrase({
      profileId: "lab",
      passphrase: "x" as never,
      expectedPublicKeyHex: LAB_AUTH_DOOR_DEFAULTS.expectedPublicKeyHex,
      context: "unlock",
    });
    expect(result.status).toBe("failed");
    expect(result.reasonCode).toBe("unsupported_runtime");
  });
});
