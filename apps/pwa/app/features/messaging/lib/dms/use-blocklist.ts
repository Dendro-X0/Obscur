import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";

type BlocklistState = Readonly<{
  blockedPublicKeys: ReadonlyArray<PublicKeyHex>;
}>;

type UseBlocklistResult = Readonly<{
  state: BlocklistState;
  addBlocked: (params: Readonly<{ publicKeyInput: string }>) => void;
  removeBlocked: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  isBlocked: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
}>;

type BlocklistPersistedV1 = Readonly<{
  version: 1;
  blockedPublicKeys: ReadonlyArray<PublicKeyHex>;
}>;

/** Canonical key shared with network `use-blocklist` (lifecycle Slice 1). */
const STORAGE_PREFIX: string = "obscur.blocklist.v1";
const LEGACY_STORAGE_PREFIX: string = "dweb.nostr.pwa.blocklist";

const defaultStateSnapshot: BlocklistState = { blockedPublicKeys: [] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isPublicKeyHex = (value: unknown): value is PublicKeyHex => isString(value) && value.length === 64;

const getStorageKey = (publicKeyHex: PublicKeyHex): string => `${STORAGE_PREFIX}.${publicKeyHex}`;
const getLegacyStorageKey = (publicKeyHex: PublicKeyHex): string => `${LEGACY_STORAGE_PREFIX}.${publicKeyHex}`;

const parsePersisted = (value: unknown): BlocklistPersistedV1 | null => {
  if (!isRecord(value)) {
    return null;
  }
  const blockedPublicKeys: unknown = value.blockedPublicKeys;
  if (!Array.isArray(blockedPublicKeys)) {
    return null;
  }
  // Accept network shape (no version) and legacy messaging shape (version: 1).
  if (value.version !== undefined && value.version !== 1) {
    return null;
  }
  const parsed: PublicKeyHex[] = blockedPublicKeys.filter((v: unknown): v is PublicKeyHex => isPublicKeyHex(v));
  return { version: 1, blockedPublicKeys: parsed };
};

const toPersisted = (state: BlocklistState): StoredCanonical => ({ blockedPublicKeys: state.blockedPublicKeys });

type StoredCanonical = Readonly<{
  blockedPublicKeys: ReadonlyArray<PublicKeyHex>;
}>;

let currentKey: string | null = null;
let currentState: BlocklistState = defaultStateSnapshot;
const listeners: Set<() => void> = new Set();

const notify = (): void => {
  listeners.forEach((listener: () => void): void => listener());
};

const setState = (next: BlocklistState): void => {
  currentState = next;
  notify();
};

const loadFromStorage = (storageKey: string): BlocklistState => {
  if (typeof window === "undefined") {
    return defaultStateSnapshot;
  }
  try {
    const raw: string | null = window.localStorage.getItem(storageKey);
    if (raw) {
      const persisted: BlocklistPersistedV1 | null = parsePersisted(JSON.parse(raw));
      if (persisted) {
        return { blockedPublicKeys: persisted.blockedPublicKeys };
      }
    }
    // Migrate legacy messaging key into canonical network key once.
    const ownerPubkey = storageKey.startsWith(`${STORAGE_PREFIX}.`)
      ? storageKey.slice(`${STORAGE_PREFIX}.`.length)
      : null;
    if (!ownerPubkey || ownerPubkey.length !== 64) {
      return defaultStateSnapshot;
    }
    const legacyRaw = window.localStorage.getItem(getLegacyStorageKey(ownerPubkey as PublicKeyHex));
    if (!legacyRaw) {
      return defaultStateSnapshot;
    }
    const legacyPersisted = parsePersisted(JSON.parse(legacyRaw));
    if (!legacyPersisted) {
      return defaultStateSnapshot;
    }
    const migrated: BlocklistState = { blockedPublicKeys: legacyPersisted.blockedPublicKeys };
    saveToStorage(storageKey, migrated);
    window.localStorage.removeItem(getLegacyStorageKey(ownerPubkey as PublicKeyHex));
    return migrated;
  } catch {
    return defaultStateSnapshot;
  }
};

const saveToStorage = (storageKey: string, state: BlocklistState): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(toPersisted(state)));
  } catch {
    return;
  }
};

const ensureKeyLoaded = (storageKey: string): void => {
  if (currentKey === storageKey) {
    return;
  }
  currentKey = storageKey;
  currentState = loadFromStorage(storageKey);
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): BlocklistState => currentState;

const updateAndPersist = (updater: (prev: BlocklistState) => BlocklistState): void => {
  if (!currentKey) {
    return;
  }
  const next: BlocklistState = updater(currentState);
  setState(next);
  saveToStorage(currentKey, next);
};

const addBlocked = (params: Readonly<{ publicKeyInput: string }>): void => {
  const parsed = parsePublicKeyInput(params.publicKeyInput);
  if (!parsed.ok) {
    return;
  }
  updateAndPersist((prev: BlocklistState): BlocklistState => {
    const exists: boolean = prev.blockedPublicKeys.includes(parsed.publicKeyHex);
    if (exists) {
      return prev;
    }
    return { blockedPublicKeys: [parsed.publicKeyHex, ...prev.blockedPublicKeys] };
  });
};

const removeBlocked = (params: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
  updateAndPersist((prev: BlocklistState): BlocklistState => ({
    blockedPublicKeys: prev.blockedPublicKeys.filter((k: PublicKeyHex): boolean => k !== params.publicKeyHex),
  }));
};

/** Remove persisted blocklist rows for an account (complete local profile removal). */
export const clearBlocklistStorage = (publicKeyHex: PublicKeyHex): void => {
  if (typeof window === "undefined") {
    return;
  }
  const storageKey = getStorageKey(publicKeyHex);
  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(getLegacyStorageKey(publicKeyHex));
  if (currentKey === storageKey) {
    currentKey = null;
    currentState = defaultStateSnapshot;
    notify();
  }
};

export const useBlocklist = (
  params: Readonly<{ publicKeyHex: PublicKeyHex | null }> = { publicKeyHex: null },
): UseBlocklistResult => {
  const storageKey: string | null = useMemo((): string | null => {
    if (!params.publicKeyHex) {
      return null;
    }
    return getStorageKey(params.publicKeyHex);
  }, [params.publicKeyHex]);
  useEffect((): void => {
    if (!storageKey) {
      return;
    }
    ensureKeyLoaded(storageKey);
    notify();
  }, [storageKey]);
  const state: BlocklistState = useSyncExternalStore(
    subscribe,
    (): BlocklistState => {
      if (!storageKey) {
        return defaultStateSnapshot;
      }
      ensureKeyLoaded(storageKey);
      return getSnapshot();
    },
    (): BlocklistState => defaultStateSnapshot
  );
  const stableIsBlocked = useMemo((): ((params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean) => {
    return (nextParams: Readonly<{ publicKeyHex: PublicKeyHex }>): boolean => state.blockedPublicKeys.includes(nextParams.publicKeyHex);
  }, [state.blockedPublicKeys]);
  return { state, addBlocked, removeBlocked, isBlocked: stableIsBlocked };
};
