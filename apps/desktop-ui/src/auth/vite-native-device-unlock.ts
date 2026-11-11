import type { DeviceUnlockPort } from "@dweb/auth/ports/device-unlock-port";
import {
  createDelegatingDeviceUnlockPort,
  createUnavailableDeviceUnlockPort,
  type DeviceUnlockHandlers,
} from "@obscur/auth-engine";

/**
 * Cut 4.1 / 4.3 — Vite-facing native DeviceUnlockPort.
 * Handlers are injectable; default is fail-closed until Cut 4.4 wires PDK/Tauri commands.
 * Must never import apps/pwa feature trees or Next unlock adapters.
 * App selection (Cut 4.3) prefers this port when Tauri is present — not a separate PRODUCT_READY gate.
 */

export const createViteNativeDeviceUnlockPort = (
  handlers?: DeviceUnlockHandlers,
): DeviceUnlockPort => {
  if (!handlers) {
    return createUnavailableDeviceUnlockPort(
      "Vite native DeviceUnlockPort handlers not wired (Cut 4.1 fail-closed)",
    );
  }
  return createDelegatingDeviceUnlockPort(handlers);
};
