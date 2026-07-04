import { isAuthEngineAuthority, AUTH_ENGINE_BOOT_RESTORE_ENABLED } from "@obscur/auth-engine";
import { isDeviceSessionRestoreAllowed, readDeviceSessionConsent } from "@/app/features/auth/services/device-session-consent";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

/** All AUTH-KERN headless gates (1–5) passed — enables runtime authority flip. */
export const AUTH_KERNEL_KERN_GATES_COMPLETE = true;

/** AUTH-K-AUTHORITY — auth-kernel is runtime owner after KERN matrix + parity gate. */
export const isAuthKernelAuthority = (): boolean => isAuthEngineAuthority();

export const AUTH_KERNEL_BAND = "AUTH-K-AUTHORITY" as const;

/**
 * AUTH-K2 boot restore path — uses Rust `auth_boot_snapshot` owner.
 * Aligns with `NATIVE_SECURE_SESSION_RESTORE_ENABLED` after AUTH-KERN-1 product flip.
 */
export const AUTH_KERNEL_BOOT_RESTORE_ENABLED = AUTH_ENGINE_BOOT_RESTORE_ENABLED;

export const isAuthKernelBootRestoreEnabled = (profileId: string): boolean => {
  if (!AUTH_KERNEL_BOOT_RESTORE_ENABLED || !hasNativeRuntime()) {
    return false;
  }
  if (isDeviceSessionRestoreAllowed(profileId)) {
    return true;
  }
  return readDeviceSessionConsent(profileId);
};
