import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { isDesktopShellBuild } from "@/app/features/runtime/shell-contract";

/** Web/PWA — fail open to login recovery without long blocking. */
export const PROFILE_BOOT_STALL_TIMEOUT_MS_WEB = 12_000;

/**
 * Desktop native profile binding (Tauri IPC, keychain, window registry) can exceed
 * 12s after profile or key switches — especially under dev HMR and online experiment.
 */
export const PROFILE_BOOT_STALL_TIMEOUT_MS_DESKTOP = 45_000;

export const resolveProfileBootStallTimeoutMs = (): number => (
  typeof window !== "undefined" && (hasNativeRuntime() || isDesktopShellBuild())
    ? PROFILE_BOOT_STALL_TIMEOUT_MS_DESKTOP
    : PROFILE_BOOT_STALL_TIMEOUT_MS_WEB
);
