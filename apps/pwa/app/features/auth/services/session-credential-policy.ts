/**
 * Session credential policy.
 *
 * Desktop Tauri: OS keychain session restore on refresh/restart (AUTH-KERN-1).
 * Never writes passphrase or private key to browser storage on desktop.
 * Mobile shell browser: device-trust tokens restore session across refresh.
 *
 * @see docs/program/obscur-offline-first-policy.md
 * @see docs/program/v1.9.6-session-persistence-redesign.md
 */

import { isDesktopShellBuild, isMobileShellBuild } from "@/app/features/runtime/shell-contract";

/** Mobile product shell build — browser dev + APK bundle share this flag. */
const MOBILE_SHELL_BUILD = isMobileShellBuild();

/** Desktop Tauri static export — primary Obscur desktop product shell. */
const DESKTOP_SHELL_BUILD = isDesktopShellBuild() && !MOBILE_SHELL_BUILD;

/**
 * Desktop OS keychain reload/restart restore — enabled after AUTH-KERN-1 headless gate.
 */
export const DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY = true;

/**
 * Restore native session from keychain/secure enclave after refresh or restart.
 * Disabled on desktop until `DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY`.
 */
export const NATIVE_SECURE_SESSION_RESTORE_ENABLED = DESKTOP_SHELL_BUILD
  ? DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY
  : true;

/**
 * Mobile shell browser: auto-unlock from scoped device-trust token after refresh.
 * Native APK/desktop still prefer keychain (tokens cleared on native persist).
 */
export const SESSION_AUTO_UNLOCK_ENABLED = MOBILE_SHELL_BUILD;

/**
 * Mobile shell browser: write trust flag + unlock token on successful login.
 * Disabled for desktop/web-only builds.
 */
export const SESSION_CREDENTIAL_PERSISTENCE_ENABLED = MOBILE_SHELL_BUILD;

/**
 * Native: persist stay-signed-in consent (trust flag only — never browser tokens).
 * Disabled on desktop until OS session restore is product-ready.
 */
export const NATIVE_DEVICE_SESSION_CONSENT_ENABLED = DESKTOP_SHELL_BUILD
  ? DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY
  : true;

export const isDesktopOsSessionRestoreAvailable = (): boolean => (
  DESKTOP_SHELL_BUILD && DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY
);

export const isNativeDeviceSessionConsentPersistenceEnabled = (): boolean => (
  NATIVE_DEVICE_SESSION_CONSENT_ENABLED
);

/** Trust flag or browser token persistence (mobile shell). */
export const isDeviceSessionTrustPersistenceEnabled = (): boolean => (
  SESSION_CREDENTIAL_PERSISTENCE_ENABLED || isNativeDeviceSessionConsentPersistenceEnabled()
);

export const sessionCredentialPolicy = {
  desktopOsSessionRestoreProductReady: DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY,
  nativeSecureSessionRestoreEnabled: NATIVE_SECURE_SESSION_RESTORE_ENABLED,
  autoUnlockEnabled: SESSION_AUTO_UNLOCK_ENABLED,
  credentialPersistenceEnabled: SESSION_CREDENTIAL_PERSISTENCE_ENABLED,
  nativeDeviceSessionConsentEnabled: NATIVE_DEVICE_SESSION_CONSENT_ENABLED,
} as const;
