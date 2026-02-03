import { useEffect, useMemo, useSyncExternalStore } from "react";

export type UserProfile = Readonly<{
  username: string;
  avatarUrl: string;
  nip05: string;
}>;

type ProfileState = Readonly<{
  profile: UserProfile;
}>;

type UseProfileResult = Readonly<{
  state: ProfileState;
  setUsername: (params: Readonly<{ username: string }>) => void;
  setAvatarUrl: (params: Readonly<{ avatarUrl: string }>) => void;
  setNip05: (params: Readonly<{ nip05: string }>) => void;
  reset: () => void;
}>;

type PersistedProfileV1 = Readonly<{
  version: 1;
  profile: UserProfile;
}>;

const STORAGE_KEY: string = "dweb.nostr.pwa.profile";

const defaultProfile: UserProfile = { username: "", avatarUrl: "", nip05: "" };

const defaultState: ProfileState = { profile: defaultProfile };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isProfile = (value: unknown): value is UserProfile => {
  if (!isRecord(value)) {
    return false;
  }
  return isString(value.username) && isString(value.avatarUrl) && (value.nip05 === undefined || isString(value.nip05));
};

const parsePersisted = (value: unknown): PersistedProfileV1 | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (value.version !== 1) {
    return null;
  }
  const profile: unknown = value.profile;
  if (!isProfile(profile)) {
    return null;
  }
  return { version: 1, profile };
};

const toPersisted = (state: ProfileState): PersistedProfileV1 => ({ version: 1, profile: state.profile });

let currentState: ProfileState = defaultState;
const listeners: Set<() => void> = new Set();

const notify = (): void => {
  listeners.forEach((listener: () => void): void => listener());
};

const setState = (next: ProfileState): void => {
  currentState = next;
  notify();
};

const loadFromStorage = (): ProfileState => {
  if (typeof window === "undefined") {
    return defaultState;
  }
  try {
    const raw: string | null = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultState;
    }
    const parsed: unknown = JSON.parse(raw);
    const persisted: PersistedProfileV1 | null = parsePersisted(parsed);
    if (!persisted) {
      return defaultState;
    }
    return { profile: persisted.profile };
  } catch {
    return defaultState;
  }
};

const saveToStorage = (state: ProfileState): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(state)));
  } catch {
    return;
  }
};

const ensureLoaded = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  if (currentState !== defaultState) {
    return;
  }
  currentState = loadFromStorage();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): ProfileState => currentState;

const updateAndPersist = (updater: (prev: ProfileState) => ProfileState): void => {
  ensureLoaded();
  const next: ProfileState = updater(currentState);
  setState(next);
  saveToStorage(next);
};

export const useProfile = (): UseProfileResult => {
  useEffect((): void => {
    ensureLoaded();
    notify();
  }, []);

  const state: ProfileState = useSyncExternalStore(
    subscribe,
    (): ProfileState => {
      ensureLoaded();
      return getSnapshot();
    },
    (): ProfileState => defaultState
  );

  const result: UseProfileResult = useMemo((): UseProfileResult => {
    return {
      state,
      setUsername: (params: Readonly<{ username: string }>): void => {
        updateAndPersist((prev: ProfileState): ProfileState => ({
          profile: { ...prev.profile, username: params.username },
        }));
      },
      setAvatarUrl: (params: Readonly<{ avatarUrl: string }>): void => {
        updateAndPersist((prev: ProfileState): ProfileState => ({
          profile: { ...prev.profile, avatarUrl: params.avatarUrl },
        }));
      },
      setNip05: (params: Readonly<{ nip05: string }>): void => {
        updateAndPersist((prev: ProfileState): ProfileState => ({
          profile: { ...prev.profile, nip05: params.nip05 },
        }));
      },
      reset: (): void => {
        updateAndPersist((): ProfileState => defaultState);
      },
    };
  }, [state]);

  return result;
};
