/** AUTH-K0 scatter — do not expand restore owners here. Migrate to @dweb/auth ports (AUTH-K1+). */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { IdentityRecord } from "@dweb/core/identity-record";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { decryptPrivateKeyHex } from "@dweb/crypto/decrypt-private-key-hex";
import { encryptPrivateKeyHex } from "@dweb/crypto/encrypt-private-key-hex";
import { generatePrivateKeyHex } from "@dweb/crypto/generate-private-key-hex";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { clearStoredIdentity } from "../utils/clear-stored-identity";
import {
  generatePoWIdentity,
  type PoWDifficulty,
} from "../services/pow-key-generator";
import { getStoredIdentity } from "../utils/get-stored-identity";
import { saveStoredIdentity } from "../utils/save-stored-identity";
import {
  ensureIdentityProfileBinding,
  findStoredIdentityBindingByPublicKey,
  recoverStoredIdentityProfile,
  recoverSingleStoredIdentityProfile,
} from "../utils/identity-profile-binding";
import { cryptoService, NATIVE_KEY_SENTINEL } from "../../crypto/crypto-service";
import { normalizePublicKeyHex } from "../../profile/utils/normalize-public-key-hex";
import { recordIdentityActivationRisk } from "@/app/shared/sybil-risk-signals";
import { clearPresenceSelfSession } from "@/app/features/network/services/presence-self-session-persistence";
import { PROFILE_CHANGED_EVENT } from "@/app/features/profiles/services/profile-registry-service";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { resolveIdentityScopeProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";
import { resolveStoredIdentityRecord, resolvePasswordProtectedIdentityRecord } from "@/app/features/profiles/services/data-root-identity-repair";
import {
  collectPasswordProtectedIdentityCandidates,
  tryUnlockIdentityWithPassphrase,
} from "@/app/features/profiles/services/identity-passphrase-unlock";
import { maybeUpgradeUnlockedIdentityRecord } from "@/app/features/profiles/services/identity-envelope-upgrade";
import {
  AccountActiveInOtherProfileWindowError,
  assertAccountNotActiveInOtherProfileWindowAsync,
  clearActiveSessionLeasesForPageReload,
} from "@/app/features/profiles/services/cross-profile-active-session-lease";
import { resolveCurrentDesktopWindowLabel } from "@/app/features/profiles/services/desktop-window-boot-payload";
import { resolveAccountImportEvidence } from "../services/account-import-evidence";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  waitForAuthKernelBootRestore,
} from "@/app/features/auth-kernel/auth-kernel-boot-owner";
import { isAuthKernelBootRestoreEnabled } from "@/app/features/auth-kernel/auth-kernel-policy";
import { accountSyncStatusStore } from "@/app/features/account-sync/services/account-sync-status-store";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { resolveActivePrivateKeyHex } from "@/app/features/auth/services/resolve-active-private-key-hex";
import { SessionApi } from "@/app/features/auth/services/session-api";
import { isRememberMeEnabledForProfile } from "@/app/features/auth/services/session-bootstrap-contracts";
import {
  isDesktopOsSessionRestoreAvailable,
} from "@/app/features/auth/services/session-credential-policy";
import {
  activateNativeStorageAtRestUnlock,
  finalizeNativeStorageAtRestLock,
} from "@/app/features/storage/services/native-storage-at-rest-service";
import {
  clearInMemoryNativeSessionBestEffort,
  endNativeDeviceSignInBestEffort,
} from "@/app/features/auth/services/native-device-session-lifecycle";
import {
  reportNativeSessionPersistFailure,
  reportNativeSessionPersistSuccess,
} from "@/app/features/auth/services/native-session-persist-feedback";
import {
  createMismatchStartupAuthState,
  createNativeRestorableStartupAuthState,
  createPendingStartupAuthState,
  createStoredLockedStartupAuthState,
  deriveStartupAuthStateFromIdentityState,
  type StartupAuthMismatchReason,
  type StartupAuthState,
} from "@/app/features/auth/services/startup-auth-state-contracts";
import { assertIdentityPassphrasePolicy } from "@/app/features/security/services/identity-passphrase-policy";
import {
  assertUnlockRateLimit,
  clearUnlockRateLimit,
  recordUnlockFailure,
} from "@/app/features/auth/services/unlock-attempt-rate-limit";
import {
  clearAuthKernelManualLock,
  isAuthKernelManualLockActive,
  markAuthKernelManualLock,
} from "@/app/features/auth-kernel/auth-kernel-manual-lock-state";
import { resetAutoLockOverlayState } from "@/app/features/settings/services/auto-lock-session-state";
import { readAuthKernelKeychainPresent } from "@/app/features/auth-kernel/auth-kernel-keychain-presence";
import { runAuthKernelSignOutCleanup } from "@/app/features/auth-kernel/auth-kernel-sign-out-cleanup";
import { reconcileWindowRuntimeBinding } from "@/app/features/runtime/services/window-runtime-binding";
import { desktopProfileRuntime } from "@/app/features/profiles/services/desktop-profile-runtime";
import { isPageReloadNavigation } from "@/app/features/profiles/services/auth-public-routes";
import { resolveStaySignedIn } from "@/app/features/auth/services/device-session-consent";
import {
  clearDeviceTrustArtifacts,
  revokeDeviceTrust,
} from "@/app/features/auth/services/device-trust-service";
import { clearNativeSessionPersistError } from "@/app/features/auth/services/native-session-persist-feedback";

export type IdentityState = Readonly<{
  status: "loading" | "locked" | "unlocked" | "error";
  stored?: IdentityRecord;
  publicKeyHex?: PublicKeyHex;
  privateKeyHex?: PrivateKeyHex;
  error?: string;
}>;

export type CreateIdentityProgress = Readonly<{
  attempts: number;
  elapsedMs: number;
  hashesPerSecond: number;
}>;

type UseIdentityResult = Readonly<{
  state: IdentityState;
  createIdentity: (params: Readonly<{ passphrase: Passphrase; username?: string; staySignedIn?: boolean }>) => Promise<void>;
  createPoWIdentity: (params: Readonly<{
    passphrase: Passphrase;
    username?: string;
    difficulty?: PoWDifficulty;
    staySignedIn?: boolean;
    onProgress?: (progress: CreateIdentityProgress) => void;
    signal?: AbortSignal;
  }>) => Promise<void>;
  importIdentity: (params: Readonly<{ privateKeyHex: PrivateKeyHex; passphrase: Passphrase; username?: string; staySignedIn?: boolean }>) => Promise<void>;
  unlockIdentity: (params: Readonly<{ passphrase: Passphrase; staySignedIn?: boolean }>) => Promise<void>;
  unlockWithPrivateKeyHex: (params: Readonly<{ privateKeyHex: PrivateKeyHex; staySignedIn?: boolean }>) => Promise<void>;
  changePassphrase: (params: Readonly<{ oldPassphrase: Passphrase; newPassphrase: Passphrase }>) => Promise<void>;
  resetPassphraseWithPrivateKey: (params: Readonly<{ privateKeyHex: PrivateKeyHex; newPassphrase: Passphrase }>) => Promise<void>;
  lockIdentity: () => void;
  forgetIdentity: () => Promise<void>;
  resetNativeSecureStorage?: () => Promise<void>;
  retryNativeSessionUnlock?: () => Promise<boolean>;
  getIdentitySnapshot: () => IdentityState;
  getIdentityDiagnostics?: () => IdentityDiagnostics;
}>;

export type IdentityDiagnostics = Readonly<{
  status: IdentityState["status"];
  startupState: StartupAuthState;
  storedPublicKeyHex?: PublicKeyHex;
  derivedPublicKeyHex?: PublicKeyHex;
  nativeSessionPublicKeyHex?: PublicKeyHex | null;
  mismatchReason?: StartupAuthMismatchReason;
  message?: string;
}>;

const createLoadingState = (): IdentityState => ({ status: "loading" });

const createLockedState = (stored?: IdentityRecord): IdentityState => ({ status: "locked", stored });

const PASSWORDLESS_NATIVE_ONLY_SENTINEL = "__obscur_native_only__";

const createUnlockedState = (params: Readonly<{ stored: IdentityRecord; privateKeyHex: PrivateKeyHex }>): IdentityState => ({
  status: "unlocked",
  stored: params.stored,
  privateKeyHex: params.privateKeyHex,
  publicKeyHex: params.stored.publicKeyHex
});

const createErrorState = (message: string, stored?: IdentityRecord): IdentityState => ({ status: "error", error: message, stored });

const createNewIdentityRecord = async (params: Readonly<{ passphrase: Passphrase; username?: string }>): Promise<IdentityRecord> => {
  const privateKeyHex: PrivateKeyHex = generatePrivateKeyHex();
  const publicKeyHex: PublicKeyHex = derivePublicKeyHex(privateKeyHex);
  const encryptedPrivateKey: string = await encryptPrivateKeyHex({ privateKeyHex, passphrase: params.passphrase });
  return { encryptedPrivateKey, publicKeyHex, username: params.username };
};

const PRIVATE_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

const isRecoverableIdentityBootstrapError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes("timed out opening identity database")
    || normalized.includes("identity database open blocked");
};

const normalizePrivateKeyHex = (value: string): PrivateKeyHex | null => {
  const normalized = value.trim().toLowerCase();
  if (!PRIVATE_KEY_HEX_PATTERN.test(normalized)) {
    return null;
  }
  return normalized as PrivateKeyHex;
};

const resolveImportedIdentityUsername = (params: Readonly<{
  requestedUsername?: string;
  importedPublicKeyHex: PublicKeyHex;
  existingStoredPublicKeyHex?: PublicKeyHex;
  existingStoredUsername?: string;
}>): string | undefined => {
  const requestedUsername = params.requestedUsername?.trim();
  if (requestedUsername && requestedUsername.length > 0) {
    return requestedUsername;
  }
  if (params.existingStoredPublicKeyHex !== params.importedPublicKeyHex) {
    return undefined;
  }
  const existingStoredUsername = params.existingStoredUsername?.trim();
  if (!existingStoredUsername || existingStoredUsername.length === 0) {
    return undefined;
  }
  return existingStoredUsername;
};

const normalizeStoredIdentityRecord = (record: IdentityRecord): IdentityRecord => {
  const normalizedPublicKeyHex = normalizePublicKeyHex(record.publicKeyHex);
  if (!normalizedPublicKeyHex) {
    throw new Error("Stored identity is corrupted: invalid public key.");
  }
  if (normalizedPublicKeyHex === record.publicKeyHex) {
    return record;
  }
  return { ...record, publicKeyHex: normalizedPublicKeyHex };
};

const assertIdentityKeyPair = (params: Readonly<{
  privateKeyHex: string;
  expectedPublicKeyHex?: PublicKeyHex;
}>): Readonly<{
  privateKeyHex: PrivateKeyHex;
  publicKeyHex: PublicKeyHex;
}> => {
  const normalizedPrivateKeyHex = normalizePrivateKeyHex(params.privateKeyHex);
  if (!normalizedPrivateKeyHex) {
    throw new Error("Invalid private key format. Expected 64-character hex.");
  }
  const derivedPublicKeyHex = derivePublicKeyHex(normalizedPrivateKeyHex);
  if (params.expectedPublicKeyHex && derivedPublicKeyHex !== params.expectedPublicKeyHex) {
    throw new Error("Private key does not match stored identity.");
  }
  return {
    privateKeyHex: normalizedPrivateKeyHex,
    publicKeyHex: derivedPublicKeyHex
  };
};

export const useIdentity = (): UseIdentityResult => {
  useEffect(() => {
    void ensureInitialized();
  }, []);
  useEffect(() => {
    const onProfileChanged = (): void => {
      void rehydrateIdentityForActiveProfile();
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
    return (): void => {
      window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
    };
  }, []);
  const state: IdentityState = useSyncExternalStore(subscribeToIdentity, getIdentitySnapshot, () => serverSnapshot);
  return useMemo(() => ({
    state,
    createIdentity: createIdentityAction,
    createPoWIdentity: createPoWIdentityAction,
    importIdentity: importIdentityAction,
    unlockIdentity: unlockIdentityAction,
    unlockWithPrivateKeyHex: unlockWithPrivateKeyHexAction,
    changePassphrase: changePassphraseAction,
    resetPassphraseWithPrivateKey: resetPassphraseWithPrivateKeyAction,
    lockIdentity: lockIdentityAction,
    forgetIdentity: forgetIdentityAction,
    resetNativeSecureStorage: resetNativeSecureStorageAction,
    retryNativeSessionUnlock: retryNativeSessionUnlockAction,
    getIdentitySnapshot,
    getIdentityDiagnostics: getIdentityDiagnosticsSnapshot
  }), [state]);
};

type NativeCryptoSessionApi = Readonly<{
  initNativeSession?: (privateKeyHex: PrivateKeyHex) => Promise<void>;
  clearNativeSession?: () => Promise<void>;
  deleteNativeKey?: () => Promise<void>;
}>;

const canUseNativeSession = (): boolean => hasNativeRuntime();

const hasFn = <T extends (...args: never[]) => unknown>(value: unknown): value is T => {
  return typeof value === "function";
};

const isPasswordlessNativeOnlyRecord = (record: IdentityRecord | undefined): boolean => {
  return record?.encryptedPrivateKey === PASSWORDLESS_NATIVE_ONLY_SENTINEL;
};

const isRememberMeEnabledStrict = (profileId: string): boolean => {
  return isRememberMeEnabledForProfile(profileId);
};

let identityMutationInFlight = 0;

const beginIdentityMutation = (): void => {
  identityMutationInFlight += 1;
};

const endIdentityMutation = (): void => {
  identityMutationInFlight = Math.max(0, identityMutationInFlight - 1);
};

let identityState: IdentityState = createLoadingState();
let hasInitialized: boolean = false;
const listeners: Set<() => void> = new Set();
let identityDiagnostics: IdentityDiagnostics = {
  status: "loading",
  startupState: createPendingStartupAuthState(),
};

const serverSnapshot: IdentityState = createLoadingState();

const notifyListeners = (): void => {
  listeners.forEach((listener: () => void) => listener());
};

const setIdentityState = (next: IdentityState): void => {
  const startupState = deriveStartupAuthStateFromIdentityState({
    identityStatus: next.status,
    storedPublicKeyHex: next.stored?.publicKeyHex,
    unlockedPublicKeyHex: next.publicKeyHex,
    nativeSessionPublicKeyHex: identityDiagnostics.nativeSessionPublicKeyHex,
    message: next.error,
  });
  identityState = next;
  identityDiagnostics = {
    status: next.status,
    startupState,
    storedPublicKeyHex: next.stored?.publicKeyHex,
    nativeSessionPublicKeyHex: identityDiagnostics.nativeSessionPublicKeyHex,
    ...(next.error ? { message: next.error } : {})
  };
  notifyListeners();
};

const clearNativeSecureSessionBestEffort = async (): Promise<void> => {
  await endNativeDeviceSignInBestEffort();
};

const applyNativeSessionPersistence = async (params: Readonly<{
  staySignedIn: boolean;
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  stored: IdentityRecord;
  context: "create" | "import" | "unlock" | "raw_unlock";
}>): Promise<void> => {
  if (!params.staySignedIn) {
    // Login without stay-signed-in: skip OS persistence but do not run sign-out keychain deletion mid-unlock.
    if (hasNativeRuntime() && isDesktopOsSessionRestoreAvailable()) {
      await clearInMemoryNativeSessionBestEffort();
    } else {
      await clearNativeSecureSessionBestEffort();
    }
    return;
  }
  await syncNativeSessionInBackground({
    publicKeyHex: params.publicKeyHex,
    privateKeyHex: params.privateKeyHex,
    stored: params.stored,
    context: params.context,
  });
};

const syncNativeSessionInBackground = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  stored: IdentityRecord;
  context: "create" | "import" | "unlock" | "raw_unlock";
}>): Promise<void> => {
  const cs: NativeCryptoSessionApi = cryptoService as unknown as NativeCryptoSessionApi;
  if (!canUseNativeSession() || !hasFn(cs.initNativeSession)) {
    return;
  }
  try {
    await bindNativeWindowProfileBestEffort();
    await cs.initNativeSession(params.privateKeyHex);
    const verified = await SessionApi.forceSessionRestore(params.publicKeyHex);
    if (!verified.isActive) {
      throw new Error("Native session did not persist to OS secure storage");
    }
    const current = getIdentitySnapshot();
    if (current.status === "unlocked" && current.stored?.publicKeyHex === params.publicKeyHex) {
      setIdentityState(createUnlockedState({
        stored: params.stored,
        privateKeyHex: NATIVE_KEY_SENTINEL,
      }));
    }
    reportNativeSessionPersistSuccess({
      context: params.context,
    });
  } catch (error) {
    const sessionStatus = await SessionApi.getSessionStatus().catch(() => null);
    if (
      sessionStatus?.isActive
      && sessionStatus.npub
      && normalizePublicKeyHex(sessionStatus.npub) === normalizePublicKeyHex(params.publicKeyHex)
    ) {
      const current = getIdentitySnapshot();
      if (current.status === "unlocked" && current.stored?.publicKeyHex === params.publicKeyHex) {
        setIdentityState(createUnlockedState({
          stored: params.stored,
          privateKeyHex: NATIVE_KEY_SENTINEL,
        }));
      }
      reportNativeSessionPersistSuccess({
        context: params.context,
      });
      return;
    }
    reportNativeSessionPersistFailure({
      context: params.context,
      error,
    });
    accountSyncStatusStore.updateSnapshot({
      publicKeyHex: params.publicKeyHex,
      lastRelayFailureReason: error instanceof Error ? error.message : String(error),
    });
  }
};

const subscribeToIdentity = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** External-store subscribe for identity — use from root binding owners only. */
export const subscribeIdentityStore = subscribeToIdentity;

export const getIdentitySnapshot = (): IdentityState => {
  return identityState;
};

const setIdentityDiagnostics = (next: IdentityDiagnostics): void => {
  identityDiagnostics = next;
  notifyListeners();
};

const setLockedAwaitingNativeRestore = (stored: IdentityRecord): void => {
  identityState = createLockedState(stored);
  identityDiagnostics = {
    status: "locked",
    startupState: createNativeRestorableStartupAuthState({
      storedPublicKeyHex: stored.publicKeyHex,
      nativeSessionPublicKeyHex: identityDiagnostics.nativeSessionPublicKeyHex ?? null,
    }),
    storedPublicKeyHex: stored.publicKeyHex,
    nativeSessionPublicKeyHex: identityDiagnostics.nativeSessionPublicKeyHex ?? null,
  };
  notifyListeners();
};

const setStoredLockedIdentityStartup = (stored: IdentityRecord): void => {
  identityState = createLockedState(stored);
  identityDiagnostics = {
    status: "locked",
    startupState: createStoredLockedStartupAuthState({
      storedPublicKeyHex: stored.publicKeyHex,
    }),
    storedPublicKeyHex: stored.publicKeyHex,
    nativeSessionPublicKeyHex: null,
  };
  notifyListeners();
};

export const getIdentityDiagnosticsSnapshot = (): IdentityDiagnostics => identityDiagnostics;

const bindNativeWindowProfileBestEffort = async (): Promise<void> => {
  if (!hasNativeRuntime()) {
    return;
  }
  const profileId = resolveIdentityScopeProfileId().trim();
  if (!profileId) {
    return;
  }
  try {
    await desktopProfileRuntime.bindCurrentWindowProfile(profileId);
  } catch {
    // Best-effort: align Rust registry before keychain/session probes.
  }
};

const resolveStoredRecordForNativePubkey = async (
  nativePublicKeyHex: PublicKeyHex,
  fallback?: IdentityRecord,
): Promise<IdentityRecord | null> => {
  const normalizedNative = normalizePublicKeyHex(nativePublicKeyHex);
  if (!normalizedNative) {
    return null;
  }
  if (fallback && normalizePublicKeyHex(fallback.publicKeyHex) === normalizedNative) {
    return fallback;
  }
  const binding = await findStoredIdentityBindingByPublicKey(normalizedNative);
  if (!binding) {
    return null;
  }
  if (hasNativeRuntime()) {
    try {
      await desktopProfileRuntime.bindCurrentWindowProfile(binding.profileId);
    } catch {
      // Best-effort realign before unlock.
    }
  }
  return binding.record;
};

const probeNativeSessionForRestore = async (
  storedHint?: IdentityRecord,
): Promise<Readonly<{ stored: IdentityRecord; nativePublicKeyHex: PublicKeyHex }> | null> => {
  if (storedHint?.publicKeyHex) {
    const targeted = await SessionApi.forceSessionRestore(storedHint.publicKeyHex);
    const targetedPubkey = normalizePublicKeyHex(targeted.npub ?? undefined);
    if (targeted.isActive && targetedPubkey) {
      const stored = await resolveStoredRecordForNativePubkey(targetedPubkey, storedHint);
      if (stored) {
        return { stored, nativePublicKeyHex: targetedPubkey };
      }
    }
  }

  const anyProfile = await SessionApi.forceSessionRestore(undefined);
  const anyPubkey = normalizePublicKeyHex(anyProfile.npub ?? undefined);
  if (!anyProfile.isActive || !anyPubkey) {
    return null;
  }
  const stored = await resolveStoredRecordForNativePubkey(anyPubkey, storedHint);
  if (!stored) {
    return null;
  }
  return { stored, nativePublicKeyHex: anyPubkey };
};

const tryNativeSessionUnlock = async (params: Readonly<{
  stored: IdentityRecord;
  context: "bootstrap" | "retry";
}>): Promise<"unlocked" | "mismatch" | "inactive" | "unavailable"> => {
  if (getIdentitySnapshot().status === "unlocked") {
    return "unlocked";
  }
  if (!canUseNativeSession()) {
    return "unavailable";
  }
  try {
    await bindNativeWindowProfileBestEffort();

    const probed = await probeNativeSessionForRestore(params.stored);
    if (!probed) {
      const status = await SessionApi.getSessionStatus();
      const fallbackPubkey = normalizePublicKeyHex(status.npub ?? undefined);
      if (!status.isActive || !fallbackPubkey) {
        return "inactive";
      }
      const normalizedStored = normalizePublicKeyHex(params.stored.publicKeyHex);
      if (normalizedStored && fallbackPubkey !== normalizedStored) {
        setIdentityState(createLockedState(params.stored));
        setIdentityDiagnostics({
          status: "locked",
          startupState: createMismatchStartupAuthState({
            storedPublicKeyHex: params.stored.publicKeyHex,
            nativeSessionPublicKeyHex: fallbackPubkey,
            mismatchReason: "native_mismatch",
            message: "Secure storage belonged to another account. Native auto-unlock was skipped. Unlock with your password/private key or reset secure storage.",
          }),
          storedPublicKeyHex: params.stored.publicKeyHex,
          nativeSessionPublicKeyHex: fallbackPubkey,
          mismatchReason: "native_mismatch",
          message: "Secure storage belonged to another account. Native auto-unlock was skipped. Unlock with your password/private key or reset secure storage.",
        });
        return "mismatch";
      }
      const stored = await resolveStoredRecordForNativePubkey(fallbackPubkey, params.stored);
      if (!stored) {
        return "inactive";
      }
      recordIdentityActivationRisk(stored.publicKeyHex);
      setIdentityDiagnostics({
        status: "unlocked",
        startupState: deriveStartupAuthStateFromIdentityState({
          identityStatus: "unlocked",
          storedPublicKeyHex: stored.publicKeyHex,
          unlockedPublicKeyHex: stored.publicKeyHex,
          nativeSessionPublicKeyHex: fallbackPubkey,
        }),
        storedPublicKeyHex: stored.publicKeyHex,
        nativeSessionPublicKeyHex: fallbackPubkey,
      });
      setIdentityState(createUnlockedState({ stored, privateKeyHex: NATIVE_KEY_SENTINEL }));
      resetAutoLockOverlayState();
      clearAuthKernelManualLock(resolveIdentityScopeProfileId());
      reconcileWindowRuntimeBinding();
      return "unlocked";
    }

    const { stored, nativePublicKeyHex } = probed;
    if (normalizePublicKeyHex(stored.publicKeyHex) !== nativePublicKeyHex) {
      setIdentityState(createLockedState(stored));
      setIdentityDiagnostics({
        status: "locked",
        startupState: createMismatchStartupAuthState({
          storedPublicKeyHex: stored.publicKeyHex,
          nativeSessionPublicKeyHex: nativePublicKeyHex,
          mismatchReason: "native_mismatch",
          message: "Secure storage belonged to another account. Native auto-unlock was skipped. Unlock with your password/private key or reset secure storage.",
        }),
        storedPublicKeyHex: stored.publicKeyHex,
        nativeSessionPublicKeyHex: nativePublicKeyHex,
        mismatchReason: "native_mismatch",
        message: "Secure storage belonged to another account. Native auto-unlock was skipped. Unlock with your password/private key or reset secure storage.",
      });
      return "mismatch";
    }
    setIdentityDiagnostics({
      status: "unlocked",
      startupState: deriveStartupAuthStateFromIdentityState({
        identityStatus: "unlocked",
        storedPublicKeyHex: stored.publicKeyHex,
        unlockedPublicKeyHex: stored.publicKeyHex,
        nativeSessionPublicKeyHex: nativePublicKeyHex,
      }),
      storedPublicKeyHex: stored.publicKeyHex,
      nativeSessionPublicKeyHex: nativePublicKeyHex,
    });
    try {
      if (!isPageReloadNavigation()) {
        await assertAccountNotActiveInOtherProfileWindowAsync({
          incomingPublicKeyHex: stored.publicKeyHex,
          currentProfileId: resolveIdentityScopeProfileId(),
          currentWindowLabel: resolveCurrentDesktopWindowLabel(),
        });
      }
    } catch (error) {
      if (error instanceof AccountActiveInOtherProfileWindowError) {
        return "inactive";
      }
      throw error;
    }
    recordIdentityActivationRisk(stored.publicKeyHex);
    setIdentityState(createUnlockedState({ stored, privateKeyHex: NATIVE_KEY_SENTINEL }));
    resetAutoLockOverlayState();
    clearAuthKernelManualLock(resolveIdentityScopeProfileId());
    reconcileWindowRuntimeBinding();
    return "unlocked";
  } catch (error) {
    if (error instanceof AccountActiveInOtherProfileWindowError) {
      throw error;
    }
    console.warn(`[Identity] Native auto-unlock status check failed during ${params.context}:`, error);
    return "unavailable";
  }
};

const rehydrateIdentityForActiveProfile = async (): Promise<void> => {
  if (identityMutationInFlight > 0) {
    return;
  }
  const current = getIdentitySnapshot();
  if (current.status === "unlocked") {
    return;
  }
  try {
    let { record: stored } = await getStoredIdentity();
    if (!stored) {
      const recoveredBinding = await recoverStoredIdentityProfile();
      stored = recoveredBinding?.record;
      if (!stored) {
        const recoveredSingle = await recoverSingleStoredIdentityProfile();
        stored = recoveredSingle?.record;
      }
    }
    stored = await resolveStoredIdentityRecord({
      profileId: resolveIdentityScopeProfileId(),
      current: stored,
    });
    setIdentityState(createLockedState(stored));
  } catch {
    setIdentityState(createLockedState(undefined));
  }
};

const ensureInitialized = async (): Promise<void> => {
  if (hasInitialized) {
    return;
  }
  hasInitialized = true;
  let stored: IdentityRecord | undefined;
  try {
    if (isPageReloadNavigation() && hasNativeRuntime()) {
      clearActiveSessionLeasesForPageReload();
    }

    if (hasNativeRuntime()) {
      stored = (await getStoredIdentity()).record;
      if (!stored) {
        const recoveredBinding = await recoverStoredIdentityProfile()
          ?? await recoverSingleStoredIdentityProfile();
        if (recoveredBinding) {
          stored = recoveredBinding.record;
          try {
            await desktopProfileRuntime.bindCurrentWindowProfile(recoveredBinding.profileId);
          } catch {
            // Best-effort profile realignment before session restore.
          }
        }
      }
      if (!stored && isPageReloadNavigation()) {
        const keychainProbe = await probeNativeSessionForRestore(undefined);
        if (keychainProbe) {
          stored = keychainProbe.stored;
        }
      }
    } else {
      const recoveredBinding = await recoverStoredIdentityProfile()
        ?? await recoverSingleStoredIdentityProfile();
      stored = recoveredBinding?.record;
      if (!stored) {
        stored = (await getStoredIdentity()).record;
      }
    }
    stored = await resolveStoredIdentityRecord({
      profileId: resolveIdentityScopeProfileId(),
      current: stored,
    });
    if (stored) {
      const normalizedStored = normalizeStoredIdentityRecord(stored);
      if (normalizedStored.publicKeyHex !== stored.publicKeyHex) {
        await ensureIdentityProfileBinding({
          publicKeyHex: normalizedStored.publicKeyHex,
          username: normalizedStored.username,
        });
        await saveStoredIdentity({ record: normalizedStored });
      }
      stored = normalizedStored;
    }

    // Native: auth-kernel boot owner restores session on desktop reload — no duplicate probe here.
    const activeProfileId = resolveIdentityScopeProfileId();
    const manualLockActive = isAuthKernelManualLockActive(activeProfileId);
    const bootRestoreEnabled = isAuthKernelBootRestoreEnabled(activeProfileId);
    if (stored && canUseNativeSession() && manualLockActive) {
      if (isPageReloadNavigation() && bootRestoreEnabled) {
        await waitForAuthKernelBootRestore(8_000);
      }
      const keychainPresent = await readAuthKernelKeychainPresent({
        profileId: activeProfileId,
        expectedPublicKeyHex: stored.publicKeyHex,
      });
      if (keychainPresent) {
        setLockedAwaitingNativeRestore(stored);
      } else {
        setStoredLockedIdentityStartup(stored);
      }
      return;
    }
    if (stored && canUseNativeSession() && bootRestoreEnabled) {
      if (isPageReloadNavigation()) {
        await waitForAuthKernelBootRestore(8_000);
      }
      if (getIdentitySnapshot().status === "unlocked") {
        return;
      }
      const diagnostics = getIdentityDiagnosticsSnapshot();
      if (diagnostics.startupState.kind === "mismatch") {
        return;
      }
      const keychainPresent = await readAuthKernelKeychainPresent({
        profileId: activeProfileId,
        expectedPublicKeyHex: stored.publicKeyHex,
      });
      if (keychainPresent) {
        setLockedAwaitingNativeRestore(stored);
        return;
      }
      setStoredLockedIdentityStartup(stored);
      return;
    }
    setIdentityState(createLockedState(stored));
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unknown error";
    if (isRecoverableIdentityBootstrapError(message)) {
      setIdentityDiagnostics({
        status: "locked",
        startupState: deriveStartupAuthStateFromIdentityState({
          identityStatus: "locked",
          storedPublicKeyHex: stored?.publicKeyHex,
          message: "Local identity storage is temporarily unavailable. Continue with manual login/import.",
        }),
        storedPublicKeyHex: stored?.publicKeyHex,
        mismatchReason: undefined,
        nativeSessionPublicKeyHex: null,
        message: "Local identity storage is temporarily unavailable. Continue with manual login/import.",
      });
      setIdentityState(createLockedState(stored));
      return;
    }
    setIdentityState(createErrorState(message, stored));
  }
};

const createIdentityAction = async (params: Readonly<{ passphrase: Passphrase; username?: string; staySignedIn?: boolean }>): Promise<void> => {
  assertIdentityPassphrasePolicy(params.passphrase);
  beginIdentityMutation();
  let record: IdentityRecord | undefined;
  try {
    record = await createNewIdentityRecord({ passphrase: params.passphrase, username: params.username });
    await ensureIdentityProfileBinding({
      publicKeyHex: record.publicKeyHex,
      username: record.username,
    });
    await saveStoredIdentity({ record });
    const decryptedPrivateKeyHex: PrivateKeyHex = await decryptPrivateKeyHex({ payload: record.encryptedPrivateKey, passphrase: params.passphrase });
    const { privateKeyHex } = assertIdentityKeyPair({
      privateKeyHex: decryptedPrivateKeyHex,
      expectedPublicKeyHex: record.publicKeyHex
    });

    setIdentityState(createUnlockedState({ stored: record, privateKeyHex }));
    recordIdentityActivationRisk(record.publicKeyHex);
    await applyNativeSessionPersistence({
      staySignedIn: resolveStaySignedIn(params),
      publicKeyHex: record.publicKeyHex,
      privateKeyHex,
      stored: record,
      context: "create",
    });
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unknown error";
    setIdentityState(createErrorState(message, record));
    throw error;
  }
};

const createPoWIdentityAction = async (params: Readonly<{
  passphrase: Passphrase;
  username?: string;
  difficulty?: PoWDifficulty;
  staySignedIn?: boolean;
  onProgress?: (progress: CreateIdentityProgress) => void;
  signal?: AbortSignal;
}>): Promise<void> => {
  beginIdentityMutation();
  let record: IdentityRecord | undefined;
  try {
    const powResult = await generatePoWIdentity(
      params.difficulty ?? "medium",
      params.onProgress,
      params.signal,
    );
    const encryptedPrivateKey: string = await encryptPrivateKeyHex({
      privateKeyHex: powResult.privateKeyHex,
      passphrase: params.passphrase,
    });
    record = {
      encryptedPrivateKey,
      publicKeyHex: powResult.publicKeyHex,
      username: params.username,
    };
    await ensureIdentityProfileBinding({
      publicKeyHex: record.publicKeyHex,
      username: record.username,
    });
    await saveStoredIdentity({ record });
    const decryptedPrivateKeyHex: PrivateKeyHex = await decryptPrivateKeyHex({
      payload: record.encryptedPrivateKey,
      passphrase: params.passphrase,
    });
    const { privateKeyHex } = assertIdentityKeyPair({
      privateKeyHex: decryptedPrivateKeyHex,
      expectedPublicKeyHex: record.publicKeyHex,
    });

    setIdentityState(createUnlockedState({ stored: record, privateKeyHex }));
    recordIdentityActivationRisk(record.publicKeyHex);
    await applyNativeSessionPersistence({
      staySignedIn: resolveStaySignedIn(params),
      publicKeyHex: record.publicKeyHex,
      privateKeyHex,
      stored: record,
      context: "create",
    });
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unknown error";
    setIdentityState(createErrorState(message, record));
    throw error;
  } finally {
    endIdentityMutation();
  }
};

const importIdentityAction = async (params: Readonly<{ privateKeyHex: PrivateKeyHex; passphrase: Passphrase; username?: string; staySignedIn?: boolean }>): Promise<void> => {
  if (params.passphrase.trim().length > 0) {
    assertIdentityPassphrasePolicy(params.passphrase);
  }
  beginIdentityMutation();
  let record: IdentityRecord | undefined;
  try {
    const { privateKeyHex, publicKeyHex } = assertIdentityKeyPair({ privateKeyHex: params.privateKeyHex });
    accountSyncStatusStore.updateSnapshot({
      publicKeyHex,
      phase: "found_account",
      status: "identity_only",
      message: "Found your account",
    });
    const encryptedPrivateKey: string = params.passphrase.trim().length === 0
      ? await (async (): Promise<string> => {
        const preserved = await resolvePasswordProtectedIdentityRecord({
          profileId: resolveIdentityScopeProfileId(),
          expectedPublicKeyHex: publicKeyHex,
        });
        if (preserved?.encryptedPrivateKey && !isPasswordlessNativeOnlyRecord(preserved)) {
          return preserved.encryptedPrivateKey;
        }
        return PASSWORDLESS_NATIVE_ONLY_SENTINEL;
      })()
      : await encryptPrivateKeyHex({
        privateKeyHex,
        passphrase: params.passphrase
      });
    const username = resolveImportedIdentityUsername({
      requestedUsername: params.username,
      importedPublicKeyHex: publicKeyHex,
      existingStoredPublicKeyHex: identityState.stored?.publicKeyHex,
      existingStoredUsername: identityState.stored?.username,
    });

    record = { encryptedPrivateKey, publicKeyHex, username };
    await ensureIdentityProfileBinding({
      publicKeyHex: record.publicKeyHex,
      username: record.username,
    });
    await saveStoredIdentity({ record });

    setIdentityState(createUnlockedState({ stored: record, privateKeyHex }));
    recordIdentityActivationRisk(record.publicKeyHex);
    await applyNativeSessionPersistence({
      staySignedIn: resolveStaySignedIn(params),
      publicKeyHex: record.publicKeyHex,
      privateKeyHex,
      stored: record,
      context: "import",
    });
    void resolveAccountImportEvidence(publicKeyHex)
      .then((importEvidence) => {
        accountSyncStatusStore.updateSnapshot({
          publicKeyHex,
          lastImportEvidence: {
            localBinding: importEvidence.localBinding,
            relayProfileEventSeen: importEvidence.relayProfileEventSeen,
            relayBackupEventSeen: importEvidence.relayBackupEventSeen,
            checkedAtUnixMs: Date.now(),
          },
        });
      })
      .catch((error) => {
        accountSyncStatusStore.updateSnapshot({
          publicKeyHex,
          lastRelayFailureReason: error instanceof Error ? error.message : String(error),
        });
      });
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Import failed";
    setIdentityState(createErrorState(message, record));
    throw error;
  } finally {
    endIdentityMutation();
  }
};

const unlockIdentityAction = async (params: Readonly<{ passphrase: Passphrase; staySignedIn?: boolean }>): Promise<void> => {
  if (!identityState.stored) {
    throw new Error("No local identity is loaded for this profile window.");
  }
  const priorStoredIdentity = identityState.stored;
  beginIdentityMutation();
  try {
    const profileId = resolveIdentityScopeProfileId();
    assertUnlockRateLimit(profileId);
    const unlockMatch = await tryUnlockIdentityWithPassphrase({
      profileId: resolveIdentityScopeProfileId(),
      publicKeyHex: priorStoredIdentity.publicKeyHex,
      passphrase: params.passphrase,
      activeRecord: priorStoredIdentity,
    });
    if (!unlockMatch) {
      const candidates = await collectPasswordProtectedIdentityCandidates({
        profileId: resolveIdentityScopeProfileId(),
        publicKeyHex: priorStoredIdentity.publicKeyHex,
      });
      if (candidates.length === 0) {
        throw new Error(
          "No device password unlock is saved for this profile on this device. Use Import Key, or restore from a workspace backup.",
        );
      }
      recordUnlockFailure(profileId);
      throw new Error("Incorrect password");
    }

    clearUnlockRateLimit(profileId);
    const storedIdentity = unlockMatch.record;
    const { privateKeyHex } = unlockMatch;
    const upgradedIdentity = await maybeUpgradeUnlockedIdentityRecord({
      record: storedIdentity,
      passphrase: params.passphrase,
    });
    const resolvedStoredIdentity = upgradedIdentity ?? storedIdentity;
    if (
      isPasswordlessNativeOnlyRecord(priorStoredIdentity)
      || priorStoredIdentity.encryptedPrivateKey !== resolvedStoredIdentity.encryptedPrivateKey
    ) {
      await saveStoredIdentity({ record: resolvedStoredIdentity });
    }

    setIdentityState(createUnlockedState({ stored: resolvedStoredIdentity, privateKeyHex }));
    recordIdentityActivationRisk(resolvedStoredIdentity.publicKeyHex);
    resetAutoLockOverlayState();
    clearAuthKernelManualLock(resolveIdentityScopeProfileId());
    reconcileWindowRuntimeBinding();
    await applyNativeSessionPersistence({
      staySignedIn: resolveStaySignedIn(params),
      publicKeyHex: resolvedStoredIdentity.publicKeyHex,
      privateKeyHex,
      stored: resolvedStoredIdentity,
      context: "unlock",
    });
    reconcileWindowRuntimeBinding();
    try {
      await activateNativeStorageAtRestUnlock({
        profileId: resolveIdentityScopeProfileId(),
        passphrase: params.passphrase,
      });
    } catch (error) {
      console.warn("[Identity] Storage-at-rest unlock failed after auth unlock (session remains unlocked):", error);
    }
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unlock failed";
    if (message.includes("does not match stored identity")) {
      setIdentityState(createLockedState(priorStoredIdentity));
      setIdentityDiagnostics({
        status: "locked",
        startupState: createMismatchStartupAuthState({
          storedPublicKeyHex: priorStoredIdentity.publicKeyHex,
          mismatchReason: "private_key_mismatch",
          message,
        }),
        storedPublicKeyHex: priorStoredIdentity.publicKeyHex,
        mismatchReason: "private_key_mismatch",
        message
      });
      throw error;
    }
    // Failed unlock attempts should keep auth flow recoverable instead of escalating runtime to fatal.
    setIdentityState(createLockedState(priorStoredIdentity));
    throw error;
  } finally {
    endIdentityMutation();
  }
};

const unlockWithPrivateKeyHexAction = async (params: Readonly<{ privateKeyHex: PrivateKeyHex; staySignedIn?: boolean }>): Promise<void> => {
  if (!identityState.stored) {
    return;
  }
  const storedIdentity = identityState.stored;
  try {
    const { privateKeyHex } = assertIdentityKeyPair({
      privateKeyHex: params.privateKeyHex,
      expectedPublicKeyHex: storedIdentity.publicKeyHex
    });
    setIdentityState(createUnlockedState({ stored: storedIdentity, privateKeyHex }));
    recordIdentityActivationRisk(storedIdentity.publicKeyHex);
    clearAuthKernelManualLock(resolveIdentityScopeProfileId());
    await applyNativeSessionPersistence({
      staySignedIn: resolveStaySignedIn(params),
      publicKeyHex: storedIdentity.publicKeyHex,
      privateKeyHex,
      stored: storedIdentity,
      context: "raw_unlock",
    });
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unlock failed";
    if (message.includes("does not match stored identity")) {
      setIdentityState(createLockedState(storedIdentity));
      setIdentityDiagnostics({
        status: "locked",
        startupState: createMismatchStartupAuthState({
          storedPublicKeyHex: storedIdentity.publicKeyHex,
          mismatchReason: "private_key_mismatch",
          message,
        }),
        storedPublicKeyHex: storedIdentity.publicKeyHex,
        mismatchReason: "private_key_mismatch",
        message
      });
      // Keep raw private-key unlock failures recoverable for lock-screen retry flows.
      throw error;
    }
    setIdentityState(createErrorState(message, storedIdentity));
    throw error;
  }
};

const changePassphraseAction = async (params: Readonly<{ oldPassphrase: Passphrase; newPassphrase: Passphrase }>): Promise<void> => {
  if (!identityState.stored) {
    throw new Error("No identity stored");
  }
  assertIdentityPassphrasePolicy(params.newPassphrase);
  try {
    const privateKeyHex: PrivateKeyHex = await decryptPrivateKeyHex({
      payload: identityState.stored.encryptedPrivateKey,
      passphrase: params.oldPassphrase
    });
    const encryptedPrivateKey: string = await encryptPrivateKeyHex({
      privateKeyHex,
      passphrase: params.newPassphrase
    });
    const updatedRecord: IdentityRecord = {
      ...identityState.stored,
      encryptedPrivateKey
    };
    await saveStoredIdentity({ record: updatedRecord });
    emitAccountSyncMutation("identity_unlock_changed");
    setIdentityState({
      ...identityState,
      stored: updatedRecord
    });
  } catch (error: unknown) {
    console.error("Failed to change passphrase:", error);
    throw new Error("Failed to change password. Please ensure your current password is correct.");
  }
};

const resetPassphraseWithPrivateKeyAction = async (params: Readonly<{ privateKeyHex: PrivateKeyHex; newPassphrase: Passphrase }>): Promise<void> => {
  if (!identityState.stored) {
    throw new Error("No identity stored");
  }
  assertIdentityPassphrasePolicy(params.newPassphrase);
  try {
    const privateKeyHex = await resolveActivePrivateKeyHex({
      privateKeyHex: params.privateKeyHex,
      expectedPublicKeyHex: identityState.stored.publicKeyHex,
    });

    const encryptedPrivateKey: string = await encryptPrivateKeyHex({
      privateKeyHex,
      passphrase: params.newPassphrase
    });

    const updatedRecord: IdentityRecord = {
      ...identityState.stored,
      encryptedPrivateKey
    };

    await saveStoredIdentity({ record: updatedRecord });
    emitAccountSyncMutation("identity_unlock_changed");

    setIdentityState({
      ...identityState,
      stored: updatedRecord,
      privateKeyHex, // Also unlock it as a courtesy
      status: "unlocked"
    });
    recordIdentityActivationRisk(updatedRecord.publicKeyHex);
  } catch (error: unknown) {
    console.error("Failed to reset passphrase with private key:", error);
    throw error;
  }
};

const lockIdentityAction = (): void => {
  void finalizeNativeStorageAtRestLock();
  const profileId = resolveIdentityScopeProfileId();
  void clearInMemoryNativeSessionBestEffort();
  markAuthKernelManualLock(profileId);
  setIdentityState(createLockedState(identityState.stored));
};

const forgetIdentityAction = async (): Promise<void> => {
  const profileId = resolveIdentityScopeProfileId();
  const publicKeyHex = identityState.stored?.publicKeyHex ?? identityState.publicKeyHex;
  try {
    await endNativeDeviceSignInBestEffort();
    await runAuthKernelSignOutCleanup(profileId);
    revokeDeviceTrust(profileId);
    clearDeviceTrustArtifacts({ profileId, includeLegacy: true });
    clearNativeSessionPersistError(profileId);
    await clearStoredIdentity();
    clearPresenceSelfSession(publicKeyHex);
    setIdentityState(createLockedState(undefined));
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unknown error";
    setIdentityState(createErrorState(message, identityState.stored));
  }
};

const resetNativeSecureStorageAction = async (): Promise<void> => {
  try {
    const profileId = resolveIdentityScopeProfileId();
    await runAuthKernelSignOutCleanup(profileId);
    await endNativeDeviceSignInBestEffort();
    setIdentityDiagnostics({
      status: identityState.stored ? "locked" : "loading",
      startupState: deriveStartupAuthStateFromIdentityState({
        identityStatus: identityState.stored ? "locked" : "loading",
        storedPublicKeyHex: identityState.stored?.publicKeyHex,
      }),
      storedPublicKeyHex: identityState.stored?.publicKeyHex,
      message: undefined,
      nativeSessionPublicKeyHex: null,
    });
    if (identityState.stored) {
      setIdentityState(createLockedState(identityState.stored));
      return;
    }
    setIdentityState(createLoadingState());
    await ensureInitialized();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reset secure storage";
    setIdentityState(createErrorState(message, identityState.stored));
    throw new Error(message);
  }
};

const retryNativeSessionUnlockAction = async (): Promise<boolean> => {
  const profileId = resolveIdentityScopeProfileId();
  if (isAuthKernelManualLockActive(profileId)) {
    return false;
  }
  const current = getIdentitySnapshot();
  if (!current.stored?.publicKeyHex) {
    await rehydrateIdentityForActiveProfile();
  }
  const stored = getIdentitySnapshot().stored;
  if (!stored) {
    return false;
  }
  const result = await tryNativeSessionUnlock({
    stored,
    context: "retry",
  });
  return result === "unlocked";
};

export const useIdentityInternals = {
  ensureInitialized,
  rehydrateIdentityForActiveProfile,
  beginIdentityMutation,
  endIdentityMutation,
  getIdentitySnapshot,
  getIdentityDiagnosticsSnapshot,
  setIdentityState,
  createUnlockedState,
  createLockedState,
  resolveImportedIdentityUsername,
  retryNativeSessionUnlockAction,
  unlockWithPrivateKeyHexAction,
  PASSWORDLESS_NATIVE_ONLY_SENTINEL,
  resetForTests: (): void => {
    identityState = createLoadingState();
    identityDiagnostics = {
      status: "loading",
      startupState: createPendingStartupAuthState(),
    };
    hasInitialized = false;
    listeners.clear();
  },
};

/** AUTH-K1 bridge — canonical identity mutations for auth-kernel adapters only. */
export const authKernelIdentityActions = {
  createIdentity: createIdentityAction,
  createPoWIdentity: createPoWIdentityAction,
  importIdentity: importIdentityAction,
  unlockIdentity: unlockIdentityAction,
  unlockWithPrivateKeyHex: unlockWithPrivateKeyHexAction,
} as const;
