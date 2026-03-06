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
import { cryptoService, NATIVE_KEY_SENTINEL } from "../../crypto/crypto-service";
import { normalizePublicKeyHex } from "../../profile/utils/normalize-public-key-hex";
import { recordIdentityActivationRisk } from "@/app/shared/sybil-risk-signals";
import { PROFILE_CHANGED_EVENT } from "@/app/features/profiles/services/profile-registry-service";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

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

const normalizePrivateKeyHex = (value: string): PrivateKeyHex | null => {
  const normalized = value.trim().toLowerCase();
  if (!PRIVATE_KEY_HEX_PATTERN.test(normalized)) {
    return null;
  }
  return normalized as PrivateKeyHex;
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
    ...identityDiagnostics,
    status: next.status,
    storedPublicKeyHex: next.stored?.publicKeyHex,
    message: next.error
  };
  notifyListeners();
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
};

export const getIdentityDiagnosticsSnapshot = (): IdentityDiagnostics => identityDiagnostics;

const rehydrateIdentityForActiveProfile = async (): Promise<void> => {
  try {
    const stored = (await getStoredIdentity()).record;
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
    if (stored) {
      const normalizedStored = normalizeStoredIdentityRecord(stored);
      if (normalizedStored.publicKeyHex !== stored.publicKeyHex) {
        await saveStoredIdentity({ record: normalizedStored });
      }
      stored = normalizedStored;
      setIdentityDiagnostics({
        status: identityState.status,
        storedPublicKeyHex: stored.publicKeyHex
      });
    }

    // Auto-unlock with native keychain if possible
    const cs: NativeCryptoSessionApi = cryptoService as unknown as NativeCryptoSessionApi;
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
          setIdentityDiagnostics({
            status: "error",
            storedPublicKeyHex: stored.publicKeyHex,
            nativeSessionPublicKeyHex: normalizedNativeNpub,
            mismatchReason: "native_mismatch",
            message: "Secure storage key does not match this account. Please unlock manually or reset secure storage."
          });
          setIdentityState(
            createErrorState(
              "Secure storage key mismatch detected. Please unlock manually or reset secure storage from Identity settings.",
              stored
            )
          );
          return;
        }
      } catch (e) {
        console.warn("[Identity] Native auto-unlock failed:", e);
      }
    }

    setIdentityState(createLockedState(stored));
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unknown error";
    setIdentityState(createErrorState(message, stored));
  }
};

const createIdentityAction = async (params: Readonly<{ passphrase: Passphrase; username?: string }>): Promise<void> => {
  let record: IdentityRecord | undefined;
  try {
    record = await createNewIdentityRecord({ passphrase: params.passphrase, username: params.username });
    await saveStoredIdentity({ record });
    const decryptedPrivateKeyHex: PrivateKeyHex = await decryptPrivateKeyHex({ payload: record.encryptedPrivateKey, passphrase: params.passphrase });
    const { privateKeyHex } = assertIdentityKeyPair({
      privateKeyHex: decryptedPrivateKeyHex,
      expectedPublicKeyHex: record.publicKeyHex
    });

    let activeKey: PrivateKeyHex = privateKeyHex;

    // Sync to native keychain if in Tauri
    const cs: NativeCryptoSessionApi = cryptoService as unknown as NativeCryptoSessionApi;
    if (canUseNativeSession() && hasFn(cs.initNativeSession)) {
      try {
        await cs.initNativeSession(privateKeyHex);
        activeKey = NATIVE_KEY_SENTINEL;
      } catch (e) {
        console.error("Failed to initialize native session:", e);
        // On Desktop/Tauri, failing to sync with native is a hard error for onboarding
        throw new Error(e instanceof Error ? e.message : "Failed to initialize secure storage. Please restart the app.");
      }
    }

    setIdentityState(createUnlockedState({ stored: record, privateKeyHex: activeKey }));
    recordIdentityActivationRisk(record.publicKeyHex);
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
    const encryptedPrivateKey: string = await encryptPrivateKeyHex({
      privateKeyHex,
      passphrase: params.passphrase
    });

    record = { encryptedPrivateKey, publicKeyHex, username: params.username };
    await saveStoredIdentity({ record });

    let activeKey: PrivateKeyHex = privateKeyHex;

    // Sync to native keychain if in Tauri
    const cs: NativeCryptoSessionApi = cryptoService as unknown as NativeCryptoSessionApi;
    if (canUseNativeSession() && hasFn(cs.initNativeSession)) {
      try {
        await cs.initNativeSession(privateKeyHex);
        activeKey = NATIVE_KEY_SENTINEL;
      } catch (e) {
        console.error("Failed to initialize native session during import:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to initialize secure storage.");
      }
    }

    setIdentityState(createUnlockedState({ stored: record, privateKeyHex: activeKey }));
    recordIdentityActivationRisk(record.publicKeyHex);
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
  try {
    const decryptedPrivateKeyHex: PrivateKeyHex = await decryptPrivateKeyHex({ payload: identityState.stored.encryptedPrivateKey, passphrase: params.passphrase });
    const { privateKeyHex } = assertIdentityKeyPair({
      privateKeyHex: decryptedPrivateKeyHex,
      expectedPublicKeyHex: identityState.stored.publicKeyHex
    });

    let activeKey: PrivateKeyHex = privateKeyHex;

    // Sync to native keychain if in Tauri
    const cs: NativeCryptoSessionApi = cryptoService as unknown as NativeCryptoSessionApi;
    if (canUseNativeSession() && hasFn(cs.initNativeSession)) {
      try {
        await cs.initNativeSession(privateKeyHex);
        activeKey = NATIVE_KEY_SENTINEL;
      } catch (e) {
        console.error("Failed to initialize native session during unlock:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to sync with secure storage.");
      }
    }

    setIdentityState(createUnlockedState({ stored: identityState.stored, privateKeyHex: activeKey }));
    recordIdentityActivationRisk(identityState.stored.publicKeyHex);
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

const unlockWithPrivateKeyHexAction = async (params: Readonly<{ privateKeyHex: PrivateKeyHex }>): Promise<void> => {
  if (!identityState.stored) {
    return;
  }
  try {
    const { privateKeyHex } = assertIdentityKeyPair({
      privateKeyHex: params.privateKeyHex,
      expectedPublicKeyHex: identityState.stored.publicKeyHex
    });
    let activeKey: PrivateKeyHex = privateKeyHex;

    // Sync to native keychain if in Tauri
    const cs: NativeCryptoSessionApi = cryptoService as unknown as NativeCryptoSessionApi;
    if (canUseNativeSession() && hasFn(cs.initNativeSession)) {
      try {
        await cs.initNativeSession(privateKeyHex);
        activeKey = NATIVE_KEY_SENTINEL;
      } catch (e) {
        console.error("Failed to initialize native session during raw unlock:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to sync with secure storage.");
      }
    }

    setIdentityState(createUnlockedState({ stored: identityState.stored, privateKeyHex: activeKey }));
    recordIdentityActivationRisk(identityState.stored.publicKeyHex);
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
