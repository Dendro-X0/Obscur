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
import { getStoredIdentity } from "../utils/get-stored-identity";
import { saveStoredIdentity } from "../utils/save-stored-identity";
import {
  ensureIdentityProfileBinding,
  recoverStoredIdentityProfile,
  recoverSingleStoredIdentityProfile,
} from "../utils/identity-profile-binding";
import { cryptoService, NATIVE_KEY_SENTINEL } from "../../crypto/crypto-service";
import { normalizePublicKeyHex } from "../../profile/utils/normalize-public-key-hex";
import { recordIdentityActivationRisk } from "@/app/shared/sybil-risk-signals";
import { PROFILE_CHANGED_EVENT } from "@/app/features/profiles/services/profile-registry-service";
import { resolveAccountImportEvidence } from "../services/account-import-evidence";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { accountSyncStatusStore } from "@/app/features/account-sync/services/account-sync-status-store";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { SessionApi } from "@/app/features/auth/services/session-api";

export type IdentityState = Readonly<{
  status: "loading" | "locked" | "unlocked" | "error";
  stored?: IdentityRecord;
  publicKeyHex?: PublicKeyHex;
  privateKeyHex?: PrivateKeyHex;
  error?: string;
}>;

type UseIdentityResult = Readonly<{
  state: IdentityState;
  createIdentity: (params: Readonly<{ passphrase: Passphrase; username?: string }>) => Promise<void>;
  importIdentity: (params: Readonly<{ privateKeyHex: PrivateKeyHex; passphrase: Passphrase; username?: string }>) => Promise<void>;
  unlockIdentity: (params: Readonly<{ passphrase: Passphrase }>) => Promise<void>;
  unlockWithPrivateKeyHex: (params: Readonly<{ privateKeyHex: PrivateKeyHex }>) => Promise<void>;
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
  storedPublicKeyHex?: PublicKeyHex;
  derivedPublicKeyHex?: PublicKeyHex;
  nativeSessionPublicKeyHex?: PublicKeyHex | null;
  mismatchReason?: "stored_public_key_invalid" | "native_mismatch" | "private_key_mismatch";
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
  hasNativeKey?: () => Promise<boolean>;
  getNativeNpub?: () => Promise<PublicKeyHex | null>;
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

let identityState: IdentityState = createLoadingState();
let hasInitialized: boolean = false;
const listeners: Set<() => void> = new Set();
let identityDiagnostics: IdentityDiagnostics = { status: "loading" };

const serverSnapshot: IdentityState = createLoadingState();

const notifyListeners = (): void => {
  listeners.forEach((listener: () => void) => listener());
};

const setIdentityState = (next: IdentityState): void => {
  identityState = next;
  identityDiagnostics = {
    status: next.status,
    storedPublicKeyHex: next.stored?.publicKeyHex,
    nativeSessionPublicKeyHex: identityDiagnostics.nativeSessionPublicKeyHex,
    ...(next.error ? { message: next.error } : {})
  };
  notifyListeners();
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
    await cs.initNativeSession(params.privateKeyHex);
    const current = getIdentitySnapshot();
    if (current.status === "unlocked" && current.stored?.publicKeyHex === params.publicKeyHex) {
      setIdentityState(createUnlockedState({
        stored: params.stored,
        privateKeyHex: NATIVE_KEY_SENTINEL,
      }));
    }
  } catch (error) {
    console.error(`Failed to initialize native session during ${params.context}:`, error);
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

export const getIdentitySnapshot = (): IdentityState => {
  return identityState;
};

const setIdentityDiagnostics = (next: IdentityDiagnostics): void => {
  identityDiagnostics = next;
  notifyListeners();
};

export const getIdentityDiagnosticsSnapshot = (): IdentityDiagnostics => identityDiagnostics;

const tryNativeSessionUnlock = async (params: Readonly<{
  stored: IdentityRecord;
  context: "bootstrap" | "retry";
}>): Promise<"unlocked" | "mismatch" | "inactive" | "unavailable"> => {
  if (!canUseNativeSession()) {
    return "unavailable";
  }
  try {
    const status = await SessionApi.getSessionStatus();
    const normalizedNativeNpub = normalizePublicKeyHex(status.npub ?? undefined);
    if (!status.isActive || !normalizedNativeNpub) {
      return "inactive";
    }
    if (normalizedNativeNpub !== params.stored.publicKeyHex) {
      setIdentityState(createLockedState(params.stored));
      setIdentityDiagnostics({
        status: "locked",
        storedPublicKeyHex: params.stored.publicKeyHex,
        nativeSessionPublicKeyHex: normalizedNativeNpub,
        mismatchReason: "native_mismatch",
        message: "Secure storage belonged to another account. Native auto-unlock was skipped. Unlock with your password/private key or reset secure storage."
      });
      return "mismatch";
    }
    setIdentityDiagnostics({
      status: "unlocked",
      storedPublicKeyHex: params.stored.publicKeyHex,
      nativeSessionPublicKeyHex: normalizedNativeNpub,
    });
    recordIdentityActivationRisk(params.stored.publicKeyHex);
    setIdentityState(createUnlockedState({ stored: params.stored, privateKeyHex: NATIVE_KEY_SENTINEL }));
    return "unlocked";
  } catch (error) {
    console.warn(`[Identity] Native auto-unlock status check failed during ${params.context}:`, error);
    return "unavailable";
  }
};

const rehydrateIdentityForActiveProfile = async (): Promise<void> => {
  const current = getIdentitySnapshot();
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
    if (
      stored
      && current.status === "unlocked"
      && current.privateKeyHex
      && current.stored?.publicKeyHex === stored.publicKeyHex
    ) {
      setIdentityState(createUnlockedState({
        stored,
        privateKeyHex: current.privateKeyHex,
      }));
      return;
    }
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
    stored = (await getStoredIdentity()).record;
    if (!stored) {
      const recovered = await recoverStoredIdentityProfile();
      stored = recovered?.record;
    }
    if (!stored) {
      const recovered = await recoverSingleStoredIdentityProfile();
      stored = recovered?.record;
    }
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
      setIdentityDiagnostics({
        status: identityState.status,
        storedPublicKeyHex: stored.publicKeyHex
      });
    }

    // Auto-unlock with native keychain/session if possible.
    const cs: NativeCryptoSessionApi = cryptoService as unknown as NativeCryptoSessionApi;
    if (stored && canUseNativeSession()) {
      const nativeSessionStatusResult = await tryNativeSessionUnlock({
        stored,
        context: "bootstrap",
      });
      if (nativeSessionStatusResult === "unlocked" || nativeSessionStatusResult === "mismatch") {
        return;
      }
    }
    if (stored && canUseNativeSession() && hasFn(cs.hasNativeKey) && await cs.hasNativeKey()) {
      try {
        const nativeNpub = hasFn(cs.getNativeNpub) ? await cs.getNativeNpub() : null;
        const normalizedNativeNpub = normalizePublicKeyHex(nativeNpub ?? undefined);
        if (normalizedNativeNpub === stored.publicKeyHex) {
          console.info("[Identity] Native key matched. Backend hydrated. Auto-unlocking...");
          setIdentityDiagnostics({
            status: "unlocked",
            storedPublicKeyHex: stored.publicKeyHex,
            nativeSessionPublicKeyHex: normalizedNativeNpub
          });
          recordIdentityActivationRisk(stored.publicKeyHex);
          setIdentityState(createUnlockedState({ stored, privateKeyHex: NATIVE_KEY_SENTINEL }));
          return;
        }
        if (normalizedNativeNpub && normalizedNativeNpub !== stored.publicKeyHex) {
          setIdentityState(createLockedState(stored));
          setIdentityDiagnostics({
            status: "locked",
            storedPublicKeyHex: stored.publicKeyHex,
            nativeSessionPublicKeyHex: normalizedNativeNpub,
            mismatchReason: "native_mismatch",
            message: "Secure storage belonged to another account. Native auto-unlock was skipped. Unlock with your password/private key or reset secure storage."
          });
          return;
        }
      } catch (e) {
        console.warn("[Identity] Native auto-unlock failed:", e);
      }
    }

    setIdentityState(createLockedState(stored));
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unknown error";
    if (isRecoverableIdentityBootstrapError(message)) {
      setIdentityDiagnostics({
        status: "locked",
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

const createIdentityAction = async (params: Readonly<{ passphrase: Passphrase; username?: string }>): Promise<void> => {
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
    void syncNativeSessionInBackground({
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

const importIdentityAction = async (params: Readonly<{ privateKeyHex: PrivateKeyHex; passphrase: Passphrase; username?: string }>): Promise<void> => {
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
      ? PASSWORDLESS_NATIVE_ONLY_SENTINEL
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
    void syncNativeSessionInBackground({
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
  }
};

const unlockIdentityAction = async (params: Readonly<{ passphrase: Passphrase }>): Promise<void> => {
  if (!identityState.stored) {
    return;
  }
  const storedIdentity = identityState.stored;
  try {
    if (isPasswordlessNativeOnlyRecord(storedIdentity)) {
      throw new Error("This profile was imported without a local password. Import the private key again or rely on native session restore.");
    }
    const decryptedPrivateKeyHex: PrivateKeyHex = await decryptPrivateKeyHex({ payload: storedIdentity.encryptedPrivateKey, passphrase: params.passphrase });
    const { privateKeyHex } = assertIdentityKeyPair({
      privateKeyHex: decryptedPrivateKeyHex,
      expectedPublicKeyHex: storedIdentity.publicKeyHex
    });

    setIdentityState(createUnlockedState({ stored: storedIdentity, privateKeyHex }));
    recordIdentityActivationRisk(storedIdentity.publicKeyHex);
    void syncNativeSessionInBackground({
      publicKeyHex: storedIdentity.publicKeyHex,
      privateKeyHex,
      stored: storedIdentity,
      context: "unlock",
    });
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unlock failed";
    if (message.includes("does not match stored identity")) {
      setIdentityDiagnostics({
        status: "error",
        storedPublicKeyHex: identityState.stored?.publicKeyHex,
        mismatchReason: "private_key_mismatch",
        message
      });
    }
    // Failed unlock attempts should keep auth flow recoverable instead of escalating runtime to fatal.
    setIdentityState(createLockedState(storedIdentity));
    throw error;
  }
};

const unlockWithPrivateKeyHexAction = async (params: Readonly<{ privateKeyHex: PrivateKeyHex }>): Promise<void> => {
  if (!identityState.stored) {
    return;
  }
  try {
    const { privateKeyHex } = assertIdentityKeyPair({
      privateKeyHex: params.privateKeyHex,
      expectedPublicKeyHex: identityState.stored.publicKeyHex
    });
    setIdentityState(createUnlockedState({ stored: identityState.stored, privateKeyHex }));
    recordIdentityActivationRisk(identityState.stored.publicKeyHex);
    void syncNativeSessionInBackground({
      publicKeyHex: identityState.stored.publicKeyHex,
      privateKeyHex,
      stored: identityState.stored,
      context: "raw_unlock",
    });
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unlock failed";
    if (message.includes("does not match stored identity")) {
      setIdentityDiagnostics({
        status: "error",
        storedPublicKeyHex: identityState.stored?.publicKeyHex,
        mismatchReason: "private_key_mismatch",
        message
      });
    }
    setIdentityState(createErrorState(message, identityState.stored));
    throw error;
  }
};

const changePassphraseAction = async (params: Readonly<{ oldPassphrase: Passphrase; newPassphrase: Passphrase }>): Promise<void> => {
  if (!identityState.stored) {
    throw new Error("No identity stored");
  }
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
  try {
    const { privateKeyHex } = assertIdentityKeyPair({
      privateKeyHex: params.privateKeyHex,
      expectedPublicKeyHex: identityState.stored.publicKeyHex
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
  setIdentityState(createLockedState(identityState.stored));
};

const forgetIdentityAction = async (): Promise<void> => {
  try {
    await clearStoredIdentity();

    // Cleanup native keychain
    const cs: NativeCryptoSessionApi = cryptoService as unknown as NativeCryptoSessionApi;
    if (canUseNativeSession() && hasFn(cs.clearNativeSession)) {
      await cs.clearNativeSession();
    }
    if (canUseNativeSession() && hasFn(cs.deleteNativeKey)) {
      await cs.deleteNativeKey();
    }

    setIdentityState(createLockedState(undefined));
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unknown error";
    setIdentityState(createErrorState(message, identityState.stored));
  }
};

const resetNativeSecureStorageAction = async (): Promise<void> => {
  const cs: NativeCryptoSessionApi = cryptoService as unknown as NativeCryptoSessionApi;
  try {
    if (canUseNativeSession() && hasFn(cs.clearNativeSession)) {
      await cs.clearNativeSession();
    }
    if (canUseNativeSession() && hasFn(cs.deleteNativeKey)) {
      await cs.deleteNativeKey();
    }
    setIdentityDiagnostics({
      status: identityState.stored ? "locked" : "loading",
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
  const stored = identityState.stored;
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
  rehydrateIdentityForActiveProfile,
  getIdentitySnapshot,
  setIdentityState,
  createUnlockedState,
  createLockedState,
  resolveImportedIdentityUsername,
  PASSWORDLESS_NATIVE_ONLY_SENTINEL,
  resetForTests: (): void => {
    identityState = createLoadingState();
    identityDiagnostics = { status: "loading" };
    hasInitialized = false;
    listeners.clear();
  },
};
