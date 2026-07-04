/**
 * Build/runtime policy snapshot — injected by app adapter (not read from env here).
 * Flip `desktopOsSessionRestoreProductReady` only after AUTH-KERN-1 passes.
 */
export type SessionCredentialPolicySnapshot = Readonly<{
  desktopOsSessionRestoreProductReady: boolean;
  nativeSecureSessionRestoreEnabled: boolean;
  nativeDeviceSessionConsentEnabled: boolean;
  credentialPersistenceEnabled: boolean;
  autoUnlockEnabled: boolean;
}>;

/** AUTH-KERN-1 gate — product-ready desktop OS restore (see charter). */
export const DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY = true;

export const createDesktopShellPolicySnapshot = (): SessionCredentialPolicySnapshot => ({
  desktopOsSessionRestoreProductReady: DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY,
  nativeSecureSessionRestoreEnabled: DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY,
  nativeDeviceSessionConsentEnabled: DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY,
  credentialPersistenceEnabled: false,
  autoUnlockEnabled: false,
});
