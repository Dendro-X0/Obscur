import { useEffect, useMemo, useSyncExternalStore } from "react";

type InviteId = string;

type Invite = Readonly<{
  id: InviteId;
  relayUrl: string;
  groupId: string;
  host: string;
  identifier: string;
  inviterPublicKeyHex?: string;
  label?: string;
  createdAtUnixMs: number;
}>;

type InvitesState = Readonly<{
  items: ReadonlyArray<Invite>;
}>;

type UseInvitesResult = Readonly<{
  state: InvitesState;
  saveInvite: (invite: Invite) => void;
  removeInvite: (params: Readonly<{ id: InviteId }>) => void;
  clear: () => void;
}>;

type PersistedInvitesV1 = Readonly<{
  version: 1;
  items: ReadonlyArray<Invite>;
}>;

const STORAGE_PREFIX: string = "dweb.nostr.pwa.invites";

const defaultStateSnapshot: InvitesState = { items: [] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number";

const isInvite = (value: unknown): value is Invite => {
  if (!isRecord(value)) {
    return false;
  }
  const id: unknown = value.id;
  const relayUrl: unknown = value.relayUrl;
  const groupId: unknown = value.groupId;
  const host: unknown = value.host;
  const identifier: unknown = value.identifier;
  const createdAtUnixMs: unknown = value.createdAtUnixMs;
  const inviterPublicKeyHex: unknown = value.inviterPublicKeyHex;
  const label: unknown = value.label;
  const inviterOk: boolean = inviterPublicKeyHex === undefined || inviterPublicKeyHex === null || isString(inviterPublicKeyHex);
  const labelOk: boolean = label === undefined || label === null || isString(label);
  return isString(id) && isString(relayUrl) && isString(groupId) && isString(host) && isString(identifier) && isNumber(createdAtUnixMs) && inviterOk && labelOk;
};

const getStorageKey = (publicKeyHex: string): string => `${STORAGE_PREFIX}.${publicKeyHex}`;

const parsePersisted = (value: unknown): PersistedInvitesV1 | null => {
  if (!isRecord(value)) {
    return null;
  }
  const version: unknown = value.version;
  const items: unknown = value.items;
  if (version !== 1 || !Array.isArray(items)) {
    return null;
  }
  const parsed: Invite[] = items.filter((v: unknown): v is Invite => isInvite(v));
  return { version: 1, items: parsed };
};

const toPersisted = (state: InvitesState): PersistedInvitesV1 => ({ version: 1, items: state.items });

let currentKey: string | null = null;
let currentState: InvitesState = defaultStateSnapshot;
const listeners: Set<() => void> = new Set();

const notify = (): void => {
  listeners.forEach((listener: () => void): void => listener());
};

const setState = (next: InvitesState): void => {
  currentState = next;
  notify();
};

const loadFromStorage = (storageKey: string): InvitesState => {
  if (typeof window === "undefined") {
    return defaultStateSnapshot;
  }
  try {
    const raw: string | null = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaultStateSnapshot;
    }
    const parsed: unknown = JSON.parse(raw);
    const persisted: PersistedInvitesV1 | null = parsePersisted(parsed);
    if (!persisted) {
      return defaultStateSnapshot;
    }
    return { items: persisted.items };
  } catch {
    return defaultStateSnapshot;
  }
};

const saveToStorage = (storageKey: string, state: InvitesState): void => {
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

const getSnapshot = (): InvitesState => currentState;

const updateAndPersist = (updater: (prev: InvitesState) => InvitesState): void => {
  if (!currentKey) {
    return;
  }
  const next: InvitesState = updater(currentState);
  setState(next);
  saveToStorage(currentKey, next);
};

const saveInvite = (invite: Invite): void => {
  updateAndPersist((prev: InvitesState): InvitesState => {
    const rest: ReadonlyArray<Invite> = prev.items.filter((i: Invite): boolean => i.id !== invite.id);
    const items: ReadonlyArray<Invite> = [invite, ...rest].sort((a: Invite, b: Invite): number => b.createdAtUnixMs - a.createdAtUnixMs);
    return { items };
  });
};

const removeInvite = (params: Readonly<{ id: InviteId }>): void => {
  updateAndPersist((prev: InvitesState): InvitesState => ({ items: prev.items.filter((i: Invite): boolean => i.id !== params.id) }));
};

const clear = (): void => {
  updateAndPersist((): InvitesState => defaultStateSnapshot);
};

export const useInvites = (params: Readonly<{ publicKeyHex: string | null }>): UseInvitesResult => {
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

  const state: InvitesState = useSyncExternalStore(
    subscribe,
    (): InvitesState => {
      if (!storageKey) {
        return defaultStateSnapshot;
      }
      ensureKeyLoaded(storageKey);
      return getSnapshot();
    },
    (): InvitesState => defaultStateSnapshot
  );

  return { state, saveInvite, removeInvite, clear };
};
