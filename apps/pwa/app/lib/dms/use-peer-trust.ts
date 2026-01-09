import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type PeerTrustState = Readonly<{
  acceptedPeers: ReadonlyArray<PublicKeyHex>;
  mutedPeers: ReadonlyArray<PublicKeyHex>;
}>;

type UsePeerTrustResult = Readonly<{
  state: PeerTrustState;
  acceptPeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  unacceptPeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  mutePeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  unmutePeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  isAccepted: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
  isMuted: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
}>;

type PeerTrustPersistedV1 = Readonly<{
  version: 1;
  acceptedPeers: ReadonlyArray<PublicKeyHex>;
  mutedPeers: ReadonlyArray<PublicKeyHex>;
}>;

const STORAGE_PREFIX: string = "dweb.nostr.pwa.peer-trust";

const defaultStateSnapshot: PeerTrustState = { acceptedPeers: [], mutedPeers: [] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isPublicKeyHex = (value: unknown): value is PublicKeyHex => isString(value) && value.length === 64;

const getStorageKey = (publicKeyHex: PublicKeyHex): string => `${STORAGE_PREFIX}.${publicKeyHex}`;

const parsePersisted = (value: unknown): PeerTrustPersistedV1 | null => {
  if (!isRecord(value)) {
    return null;
  }
  const version: unknown = value.version;
  const acceptedPeers: unknown = value.acceptedPeers;
  const mutedPeers: unknown = value.mutedPeers;
  if (version !== 1 || !Array.isArray(acceptedPeers) || !Array.isArray(mutedPeers)) {
    return null;
  }
  const parsedAccepted: PublicKeyHex[] = acceptedPeers.filter((v: unknown): v is PublicKeyHex => isPublicKeyHex(v));
  const parsedMuted: PublicKeyHex[] = mutedPeers.filter((v: unknown): v is PublicKeyHex => isPublicKeyHex(v));
  return { version: 1, acceptedPeers: parsedAccepted, mutedPeers: parsedMuted };
};

const toPersisted = (state: PeerTrustState): PeerTrustPersistedV1 => ({ version: 1, acceptedPeers: state.acceptedPeers, mutedPeers: state.mutedPeers });

let currentKey: string | null = null;
let currentState: PeerTrustState = defaultStateSnapshot;
const listeners: Set<() => void> = new Set();

const notify = (): void => {
  listeners.forEach((listener: () => void): void => listener());
};

const setState = (next: PeerTrustState): void => {
  currentState = next;
  notify();
};

const loadFromStorage = (storageKey: string): PeerTrustState => {
  if (typeof window === "undefined") {
    return defaultStateSnapshot;
  }
  try {
    const raw: string | null = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaultStateSnapshot;
    }
    const parsed: unknown = JSON.parse(raw);
    const persisted: PeerTrustPersistedV1 | null = parsePersisted(parsed);
    if (!persisted) {
      return defaultStateSnapshot;
    }
    return { acceptedPeers: persisted.acceptedPeers, mutedPeers: persisted.mutedPeers };
  } catch {
    return defaultStateSnapshot;
  }
};

const saveToStorage = (storageKey: string, state: PeerTrustState): void => {
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

const getSnapshot = (): PeerTrustState => currentState;

const updateAndPersist = (updater: (prev: PeerTrustState) => PeerTrustState): void => {
  if (!currentKey) {
    return;
  }
  const next: PeerTrustState = updater(currentState);
  setState(next);
  saveToStorage(currentKey, next);
};

const addUnique = (list: ReadonlyArray<PublicKeyHex>, value: PublicKeyHex): ReadonlyArray<PublicKeyHex> => {
  if (list.includes(value)) {
    return list;
  }
  return [value, ...list];
};

const removeValue = (list: ReadonlyArray<PublicKeyHex>, value: PublicKeyHex): ReadonlyArray<PublicKeyHex> => {
  return list.filter((k: PublicKeyHex): boolean => k !== value);
};

const acceptPeer = (params: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
  updateAndPersist((prev: PeerTrustState): PeerTrustState => ({
    acceptedPeers: addUnique(prev.acceptedPeers, params.publicKeyHex),
    mutedPeers: removeValue(prev.mutedPeers, params.publicKeyHex),
  }));
};

const unacceptPeer = (params: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
  updateAndPersist((prev: PeerTrustState): PeerTrustState => ({
    ...prev,
    acceptedPeers: removeValue(prev.acceptedPeers, params.publicKeyHex),
  }));
};

const mutePeer = (params: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
  updateAndPersist((prev: PeerTrustState): PeerTrustState => ({
    acceptedPeers: removeValue(prev.acceptedPeers, params.publicKeyHex),
    mutedPeers: addUnique(prev.mutedPeers, params.publicKeyHex),
  }));
};

const unmutePeer = (params: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
  updateAndPersist((prev: PeerTrustState): PeerTrustState => ({
    ...prev,
    mutedPeers: removeValue(prev.mutedPeers, params.publicKeyHex),
  }));
};

export const usePeerTrust = (params: Readonly<{ publicKeyHex: PublicKeyHex | null }>): UsePeerTrustResult => {
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
  const state: PeerTrustState = useSyncExternalStore(
    subscribe,
    (): PeerTrustState => {
      if (!storageKey) {
        return defaultStateSnapshot;
      }
      ensureKeyLoaded(storageKey);
      return getSnapshot();
    },
    (): PeerTrustState => defaultStateSnapshot
  );
  const stableIsAccepted = useMemo((): ((params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean) => {
    return (nextParams: Readonly<{ publicKeyHex: PublicKeyHex }>): boolean => state.acceptedPeers.includes(nextParams.publicKeyHex);
  }, [state.acceptedPeers]);
  const stableIsMuted = useMemo((): ((params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean) => {
    return (nextParams: Readonly<{ publicKeyHex: PublicKeyHex }>): boolean => state.mutedPeers.includes(nextParams.publicKeyHex);
  }, [state.mutedPeers]);
  return { state, acceptPeer, unacceptPeer, mutePeer, unmutePeer, isAccepted: stableIsAccepted, isMuted: stableIsMuted };
};
