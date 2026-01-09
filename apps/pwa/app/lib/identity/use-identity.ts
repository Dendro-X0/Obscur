import { useEffect, useSyncExternalStore } from "react";
import type { IdentityRecord } from "@dweb/core/identity-record";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { decryptPrivateKeyHex } from "@dweb/crypto/decrypt-private-key-hex";
import { encryptPrivateKeyHex } from "@dweb/crypto/encrypt-private-key-hex";
import { generatePrivateKeyHex } from "@dweb/crypto/generate-private-key-hex";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { clearStoredIdentity } from "./clear-stored-identity";
import { getStoredIdentity } from "./get-stored-identity";
import { saveStoredIdentity } from "./save-stored-identity";

type IdentityState = Readonly<{
  status: "loading" | "locked" | "unlocked" | "error";
  stored?: IdentityRecord;
  publicKeyHex?: PublicKeyHex;
  privateKeyHex?: PrivateKeyHex;
  error?: string;
}>;

type UseIdentityResult = Readonly<{
  state: IdentityState;
  createIdentity: (params: Readonly<{ passphrase: Passphrase }>) => Promise<void>;
  unlockIdentity: (params: Readonly<{ passphrase: Passphrase }>) => Promise<void>;
  lockIdentity: () => void;
  forgetIdentity: () => Promise<void>;
}>;

const createLoadingState = (): IdentityState => ({ status: "loading" });

const createLockedState = (stored?: IdentityRecord): IdentityState => ({ status: "locked", stored });

const createUnlockedState = (params: Readonly<{ stored: IdentityRecord; privateKeyHex: PrivateKeyHex }>): IdentityState => ({
  status: "unlocked",
  stored: params.stored,
  privateKeyHex: params.privateKeyHex,
  publicKeyHex: params.stored.publicKeyHex
});

const createErrorState = (message: string): IdentityState => ({ status: "error", error: message });

const createNewIdentityRecord = async (params: Readonly<{ passphrase: Passphrase }>): Promise<IdentityRecord> => {
  const privateKeyHex: PrivateKeyHex = generatePrivateKeyHex();
  const publicKeyHex: PublicKeyHex = derivePublicKeyHex(privateKeyHex);
  const encryptedPrivateKey: string = await encryptPrivateKeyHex({ privateKeyHex, passphrase: params.passphrase });
  return { encryptedPrivateKey, publicKeyHex };
};

export const useIdentity = (): UseIdentityResult => {
  useEffect(() => {
    void ensureInitialized();
  }, []);
  const state: IdentityState = useSyncExternalStore(subscribeToIdentity, getIdentitySnapshot, () => serverSnapshot);
  return { state, createIdentity: createIdentityAction, unlockIdentity: unlockIdentityAction, lockIdentity: lockIdentityAction, forgetIdentity: forgetIdentityAction };
};

let identityState: IdentityState = createLoadingState();
let hasInitialized: boolean = false;
const listeners: Set<() => void> = new Set();

const serverSnapshot: IdentityState = createLoadingState();

const notifyListeners = (): void => {
  listeners.forEach((listener: () => void) => listener());
};

const setIdentityState = (next: IdentityState): void => {
  identityState = next;
  notifyListeners();
};

const subscribeToIdentity = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getIdentitySnapshot = (): IdentityState => {
  return identityState;
};

const ensureInitialized = async (): Promise<void> => {
  if (hasInitialized) {
    return;
  }
  hasInitialized = true;
  try {
    const stored: IdentityRecord | undefined = (await getStoredIdentity()).record;
    setIdentityState(createLockedState(stored));
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unknown error";
    setIdentityState(createErrorState(message));
  }
};

const createIdentityAction = async (params: Readonly<{ passphrase: Passphrase }>): Promise<void> => {
  try {
    const record: IdentityRecord = await createNewIdentityRecord({ passphrase: params.passphrase });
    await saveStoredIdentity({ record });
    const privateKeyHex: PrivateKeyHex = await decryptPrivateKeyHex({ payload: record.encryptedPrivateKey, passphrase: params.passphrase });
    setIdentityState(createUnlockedState({ stored: record, privateKeyHex }));
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unknown error";
    setIdentityState(createErrorState(message));
  }
};

const unlockIdentityAction = async (params: Readonly<{ passphrase: Passphrase }>): Promise<void> => {
  if (!identityState.stored) {
    return;
  }
  try {
    const privateKeyHex: PrivateKeyHex = await decryptPrivateKeyHex({ payload: identityState.stored.encryptedPrivateKey, passphrase: params.passphrase });
    setIdentityState(createUnlockedState({ stored: identityState.stored, privateKeyHex }));
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unlock failed";
    setIdentityState(createErrorState(message));
  }
};

const lockIdentityAction = (): void => {
  setIdentityState(createLockedState(identityState.stored));
};

const forgetIdentityAction = async (): Promise<void> => {
  try {
    await clearStoredIdentity();
    setIdentityState(createLockedState(undefined));
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unknown error";
    setIdentityState(createErrorState(message));
  }
};
