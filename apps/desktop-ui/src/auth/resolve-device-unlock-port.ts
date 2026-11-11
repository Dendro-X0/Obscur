import type { DeviceUnlockPort } from "@dweb/auth/ports/device-unlock-port";
import {
  resolveDesktopUiAdapterSource,
  type DesktopUiAdapterSource,
} from "../runtime/desktop-ui-adapter-selection";

export type DeviceUnlockPortSource = DesktopUiAdapterSource;

export type ResolveDeviceUnlockPortParams = Readonly<{
  isNativeRuntime: boolean;
  /** Explicit CI/lab force — OBSCUR_DESKTOP_UI_LAB_STUBS=1 */
  forceLabStubs?: boolean;
  labPort: DeviceUnlockPort;
  nativePort: DeviceUnlockPort;
}>;

export type ResolvedDeviceUnlockPort = Readonly<{
  port: DeviceUnlockPort;
  source: DeviceUnlockPortSource;
}>;

/**
 * Cut 4.3 — prefer native DeviceUnlockPort when Tauri host is present.
 * Lab stubs only when forced or host absent.
 */
export const resolveDesktopUiDeviceUnlockPort = (
  params: ResolveDeviceUnlockPortParams,
): ResolvedDeviceUnlockPort => {
  const source = resolveDesktopUiAdapterSource({
    isNativeRuntime: params.isNativeRuntime,
    forceLabStubs: params.forceLabStubs,
  });
  return {
    source,
    port: source === "lab" ? params.labPort : params.nativePort,
  };
};

export {
  readDesktopUiLabStubsForced,
} from "../runtime/desktop-ui-adapter-selection";
