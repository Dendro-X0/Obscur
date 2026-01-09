import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type RequestItem = Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  lastMessagePreview: string;
  lastReceivedAtUnixSeconds: number;
  unreadCount: number;
}>;

type RequestsInboxState = Readonly<{
  items: ReadonlyArray<RequestItem>;
}>;

type UseRequestsInboxResult = Readonly<{
  state: RequestsInboxState;
  upsertIncoming: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex; plaintext: string; createdAtUnixSeconds: number }>) => void;
  markRead: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => void;
  remove: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => void;
}>;

type RequestsInboxPersistedV1 = Readonly<{
  version: 1;
  items: ReadonlyArray<RequestItem>;
}>;

const STORAGE_PREFIX: string = "dweb.nostr.pwa.requests";

const defaultStateSnapshot: RequestsInboxState = { items: [] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number";

const isPublicKeyHex = (value: unknown): value is PublicKeyHex => isString(value) && value.length === 64;

const isRequestItem = (value: unknown): value is RequestItem => {
  if (!isRecord(value)) {
    return false;
  }
  return isPublicKeyHex(value.peerPublicKeyHex) && isString(value.lastMessagePreview) && isNumber(value.lastReceivedAtUnixSeconds) && isNumber(value.unreadCount);
};

const getStorageKey = (publicKeyHex: PublicKeyHex): string => `${STORAGE_PREFIX}.${publicKeyHex}`;

const parsePersisted = (value: unknown): RequestsInboxPersistedV1 | null => {
  if (!isRecord(value)) {
    return null;
  }
  const version: unknown = value.version;
  const items: unknown = value.items;
  if (version !== 1 || !Array.isArray(items)) {
    return null;
  }
  const parsed: RequestItem[] = items.filter((v: unknown): v is RequestItem => isRequestItem(v));
  return { version: 1, items: parsed };
};

const toPersisted = (state: RequestsInboxState): RequestsInboxPersistedV1 => ({ version: 1, items: state.items });

let currentKey: string | null = null;
let currentState: RequestsInboxState = defaultStateSnapshot;
const listeners: Set<() => void> = new Set();

const notify = (): void => {
  listeners.forEach((listener: () => void): void => listener());
};

const setState = (next: RequestsInboxState): void => {
  currentState = next;
  notify();
};

const loadFromStorage = (storageKey: string): RequestsInboxState => {
  if (typeof window === "undefined") {
    return defaultStateSnapshot;
  }
  try {
    const raw: string | null = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaultStateSnapshot;
    }
    const parsed: unknown = JSON.parse(raw);
    const persisted: RequestsInboxPersistedV1 | null = parsePersisted(parsed);
    if (!persisted) {
      return defaultStateSnapshot;
    }
    return { items: persisted.items };
  } catch {
    return defaultStateSnapshot;
  }
};

const saveToStorage = (storageKey: string, state: RequestsInboxState): void => {
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

const getSnapshot = (): RequestsInboxState => currentState;

const updateAndPersist = (updater: (prev: RequestsInboxState) => RequestsInboxState): void => {
  if (!currentKey) {
    return;
  }
  const next: RequestsInboxState = updater(currentState);
  setState(next);
  saveToStorage(currentKey, next);
};

const toPreview = (plaintext: string): string => {
  const trimmed: string = plaintext.trim();
  if (!trimmed) {
    return "(no content)";
  }
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
};

const upsertIncoming = (params: Readonly<{ peerPublicKeyHex: PublicKeyHex; plaintext: string; createdAtUnixSeconds: number }>): void => {
  updateAndPersist((prev: RequestsInboxState): RequestsInboxState => {
    const existing: RequestItem | undefined = prev.items.find((i: RequestItem): boolean => i.peerPublicKeyHex === params.peerPublicKeyHex);
    const preview: string = toPreview(params.plaintext);
    const nextItem: RequestItem = existing
      ? {
          peerPublicKeyHex: existing.peerPublicKeyHex,
          lastMessagePreview: preview,
          lastReceivedAtUnixSeconds: Math.max(existing.lastReceivedAtUnixSeconds, params.createdAtUnixSeconds),
          unreadCount: existing.unreadCount + 1,
        }
      : {
          peerPublicKeyHex: params.peerPublicKeyHex,
          lastMessagePreview: preview,
          lastReceivedAtUnixSeconds: params.createdAtUnixSeconds,
          unreadCount: 1,
        };
    const rest: ReadonlyArray<RequestItem> = prev.items.filter((i: RequestItem): boolean => i.peerPublicKeyHex !== params.peerPublicKeyHex);
    const items: ReadonlyArray<RequestItem> = [nextItem, ...rest].sort((a: RequestItem, b: RequestItem) => b.lastReceivedAtUnixSeconds - a.lastReceivedAtUnixSeconds);
    return { items };
  });
};

const markRead = (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
  updateAndPersist((prev: RequestsInboxState): RequestsInboxState => ({
    items: prev.items.map((i: RequestItem): RequestItem => (i.peerPublicKeyHex === params.peerPublicKeyHex ? { ...i, unreadCount: 0 } : i)),
  }));
};

const remove = (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
  updateAndPersist((prev: RequestsInboxState): RequestsInboxState => ({
    items: prev.items.filter((i: RequestItem): boolean => i.peerPublicKeyHex !== params.peerPublicKeyHex),
  }));
};

export const useRequestsInbox = (params: Readonly<{ publicKeyHex: PublicKeyHex | null }>): UseRequestsInboxResult => {
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
  const state: RequestsInboxState = useSyncExternalStore(
    subscribe,
    (): RequestsInboxState => {
      if (!storageKey) {
        return defaultStateSnapshot;
      }
      ensureKeyLoaded(storageKey);
      return getSnapshot();
    },
    (): RequestsInboxState => defaultStateSnapshot
  );
  return { state, upsertIncoming, markRead, remove };
};
