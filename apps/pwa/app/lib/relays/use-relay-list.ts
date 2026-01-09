import { useEffect, useMemo, useSyncExternalStore } from "react";
import { validateRelayUrl } from "./validate-relay-url";

type RelayListItem = Readonly<{
  url: string;
  enabled: boolean;
}>;

type RelayListState = Readonly<{
  relays: ReadonlyArray<RelayListItem>;
}>;

type UseRelayListResult = Readonly<{
  state: RelayListState;
  addRelay: (params: Readonly<{ url: string }>) => void;
  removeRelay: (params: Readonly<{ url: string }>) => void;
  setRelayEnabled: (params: Readonly<{ url: string; enabled: boolean }>) => void;
  moveRelay: (params: Readonly<{ url: string; direction: "up" | "down" }>) => void;
}>;

type RelayListPersistedV1 = Readonly<{
  version: 1;
  relays: ReadonlyArray<RelayListItem>;
}>;

const STORAGE_PREFIX: string = "dweb.nostr.pwa.relays";

const DEFAULT_RELAY_URLS: ReadonlyArray<string> = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
];

const createDefaultState = (): RelayListState => ({
  relays: DEFAULT_RELAY_URLS.map((url: string): RelayListItem => ({ url, enabled: true })),
});

const defaultStateSnapshot: RelayListState = createDefaultState();

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const normalizeRelayUrl = (rawUrl: string): string | null => {
  const validated: Readonly<{ normalizedUrl: string }> | null = validateRelayUrl(rawUrl);
  return validated ? validated.normalizedUrl : null;
};

const getStorageKey = (publicKeyHex: string): string => `${STORAGE_PREFIX}.${publicKeyHex}`;

const parsePersisted = (value: unknown): RelayListPersistedV1 | null => {
  if (!isRecord(value)) {
    return null;
  }
  const version: unknown = value.version;
  const relays: unknown = value.relays;
  if (version !== 1 || !Array.isArray(relays)) {
    return null;
  }
  const parsed: RelayListItem[] = relays
    .map((item: unknown): RelayListItem | null => {
      if (!isRecord(item)) {
        return null;
      }
      const url: unknown = item.url;
      const enabled: unknown = item.enabled;
      if (!isString(url) || !isBoolean(enabled)) {
        return null;
      }
      const normalized: string | null = normalizeRelayUrl(url);
      if (!normalized) {
        return null;
      }
      return { url: normalized, enabled };
    })
    .filter((item: RelayListItem | null): item is RelayListItem => item !== null);
  if (parsed.length === 0) {
    return null;
  }
  return { version: 1, relays: parsed };
};

const toPersisted = (state: RelayListState): RelayListPersistedV1 => ({ version: 1, relays: state.relays });

let currentKey: string | null = null;
let currentState: RelayListState = createDefaultState();
const listeners: Set<() => void> = new Set();

const notify = (): void => {
  listeners.forEach((listener: () => void) => listener());
};

const setState = (next: RelayListState): void => {
  currentState = next;
  notify();
};

const loadFromStorage = (storageKey: string): RelayListState => {
  if (typeof window === "undefined") {
    return defaultStateSnapshot;
  }
  try {
    const raw: string | null = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaultStateSnapshot;
    }
    const parsed: unknown = JSON.parse(raw);
    const persisted: RelayListPersistedV1 | null = parsePersisted(parsed);
    if (!persisted) {
      return defaultStateSnapshot;
    }
    return { relays: persisted.relays };
  } catch {
    return defaultStateSnapshot;
  }
};

const saveToStorage = (storageKey: string, state: RelayListState): void => {
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

const getSnapshot = (): RelayListState => currentState;

const updateAndPersist = (updater: (prev: RelayListState) => RelayListState): void => {
  if (!currentKey) {
    return;
  }
  const next: RelayListState = updater(currentState);
  setState(next);
  saveToStorage(currentKey, next);
};

const addRelay = (params: Readonly<{ url: string }>): void => {
  const normalized: string | null = normalizeRelayUrl(params.url);
  if (!normalized) {
    return;
  }
  updateAndPersist((prev: RelayListState): RelayListState => {
    const exists: boolean = prev.relays.some((relay: RelayListItem): boolean => relay.url === normalized);
    if (exists) {
      return prev;
    }
    return { relays: [{ url: normalized, enabled: true }, ...prev.relays] };
  });
};

const removeRelay = (params: Readonly<{ url: string }>): void => {
  updateAndPersist((prev: RelayListState): RelayListState => {
    const next: ReadonlyArray<RelayListItem> = prev.relays.filter((relay: RelayListItem): boolean => relay.url !== params.url);
    return next.length > 0 ? { relays: next } : createDefaultState();
  });
};

const setRelayEnabled = (params: Readonly<{ url: string; enabled: boolean }>): void => {
  updateAndPersist((prev: RelayListState): RelayListState => ({
    relays: prev.relays.map((relay: RelayListItem): RelayListItem =>
      relay.url === params.url ? { ...relay, enabled: params.enabled } : relay
    ),
  }));
};

const moveRelay = (params: Readonly<{ url: string; direction: "up" | "down" }>): void => {
  updateAndPersist((prev: RelayListState): RelayListState => {
    const index: number = prev.relays.findIndex((relay: RelayListItem): boolean => relay.url === params.url);
    if (index < 0) {
      return prev;
    }
    const delta: number = params.direction === "up" ? -1 : 1;
    const nextIndex: number = index + delta;
    if (nextIndex < 0 || nextIndex >= prev.relays.length) {
      return prev;
    }
    const next: RelayListItem[] = [...prev.relays];
    const temp: RelayListItem = next[index] as RelayListItem;
    next[index] = next[nextIndex] as RelayListItem;
    next[nextIndex] = temp;
    return { relays: next };
  });
};

export const useRelayList = (params: Readonly<{ publicKeyHex: string | null }>): UseRelayListResult => {
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

  const state: RelayListState = useSyncExternalStore(
    subscribe,
    (): RelayListState => {
      if (!storageKey) {
        return defaultStateSnapshot;
      }
      ensureKeyLoaded(storageKey);
      return getSnapshot();
    },
    (): RelayListState => defaultStateSnapshot
  );

  return {
    state,
    addRelay,
    removeRelay,
    setRelayEnabled,
    moveRelay,
  };
};
