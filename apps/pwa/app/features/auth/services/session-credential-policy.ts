/**
 * Session credential policy.
 *
 * Native desktop/mobile: restore unlocked session from OS secure storage (keychain)
 * after refresh — private key never stored in localStorage or as a passphrase token.
 *
 * Web PWA: no remember-me tokens or auto-unlock from stored passphrases.
 *
 * @see docs/program/obscur-offline-first-policy.md
 */

/** Restore native session from keychain/secure enclave when the app restarts or the page refreshes. */
export const NATIVE_SECURE_SESSION_RESTORE_ENABLED = true as const;

/** When false, AuthGateway must not auto-unlock from web remember-me tokens or passphrases. */
export const SESSION_AUTO_UNLOCK_ENABLED = false as const;

/** When false, login flows must not write remember-me flags or passphrase tokens to web storage. */
export const SESSION_CREDENTIAL_PERSISTENCE_ENABLED = false as const;

export const sessionCredentialPolicy = {
  nativeSecureSessionRestoreEnabled: NATIVE_SECURE_SESSION_RESTORE_ENABLED,
  autoUnlockEnabled: SESSION_AUTO_UNLOCK_ENABLED,
  credentialPersistenceEnabled: SESSION_CREDENTIAL_PERSISTENCE_ENABLED,
} as const;
