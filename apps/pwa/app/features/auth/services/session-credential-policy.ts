/**
 * Session credential policy.
 *
 * Native desktop/mobile: restore unlocked session from OS secure storage (keychain)
 * after refresh — private key never stored in localStorage or as a passphrase token.
 *
 * Mobile shell browser (P12 dev / static export without Tauri bridge): device-trust
 * tokens restore session across refresh. Full web PWA remains manual unlock.
 *
 * @see docs/program/obscur-offline-first-policy.md
 */

import { isMobileShellBuild } from "@/app/features/runtime/shell-contract";

/** Mobile product shell build — browser dev + APK bundle share this flag. */
const MOBILE_SHELL_BUILD = isMobileShellBuild();

/** Restore native session from keychain/secure enclave when the app restarts or the page refreshes. */
export const NATIVE_SECURE_SESSION_RESTORE_ENABLED = true as const;

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

export const sessionCredentialPolicy = {
  nativeSecureSessionRestoreEnabled: NATIVE_SECURE_SESSION_RESTORE_ENABLED,
  autoUnlockEnabled: SESSION_AUTO_UNLOCK_ENABLED,
  credentialPersistenceEnabled: SESSION_CREDENTIAL_PERSISTENCE_ENABLED,
} as const;
