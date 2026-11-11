/**
 * Cut 0.3 — session storage orchestrator.
 * Product-facing door for opening / probing / rebinding profile PDK + SQLite.
 * Feature modules must not passphrase-activate or keychain-restore directly.
 *
 * @see specs/backend/cut0-account-spine-design-2026-11-09.md §9 / slice 0.3
 */

export {
  activateNativeStorageAtRestUnlock as openStorageSessionWithPassphrase,
  syncNativeVaultEncryptionSessionAfterIdentityUnlock as openStorageSessionAfterIdentityUnlock,
  restoreNativeVaultEncryptionSessionIfNeeded as restoreStorageSessionFromKeychain,
  ensureNativeSqliteOpenForWrites as ensureStorageSessionOpenForUnlock,
  rebindNativeSqliteIfSessionOpen,
  probeNativeSqliteWriteReady,
  finalizeNativeStorageAtRestLock as closeStorageSession,
  resolveSoftLockUnlockMode,
} from "./native-storage-at-rest-service";

export type { SoftLockUnlockMode, SoftLockUnlockModeInput } from "./native-storage-at-rest-service";
