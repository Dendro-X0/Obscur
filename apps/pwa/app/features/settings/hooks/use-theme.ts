"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { PROFILE_CHANGED_EVENT } from "@/app/features/profiles/services/profile-registry-service";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

type ThemePreference = "system" | "light" | "dark";

type ThemeSnapshot = Readonly<{
  preference: ThemePreference;
}>;

type ThemeStore = Readonly<{
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ThemeSnapshot;
  setPreference: (preference: ThemePreference) => void;
  initializeFromStorage: () => void;
  reloadFromStorage: () => void;
}>;

const STORAGE_KEY: string = "dweb.nostr.pwa.ui.theme";
const SERVER_SNAPSHOT: ThemeSnapshot = { preference: "system" };

const isThemePreference = (value: unknown): value is ThemePreference => {
  return value === "system" || value === "light" || value === "dark";
};

const loadPreferenceFromStorage = (): ThemePreference => {
  if (typeof window === "undefined") {
    return "system";
  }
  try {
    const raw: string | null =
      window.localStorage.getItem(getStorageKey())
      ?? window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return "system";
    }
    if (!isThemePreference(raw)) {
      return "system";
    }
    return raw;
  } catch {
    return "system";
  }
};

const savePreferenceToStorage = (preference: ThemePreference): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getStorageKey(), preference);
  } catch {
    return;
  }
};

const createStore = (): ThemeStore => {
  const listeners: Set<() => void> = new Set<() => void>();
  let preference: ThemePreference = "system";
  let didInit: boolean = false;
  let snapshot: ThemeSnapshot = { preference };
  const emit = (): void => {
    listeners.forEach((listener: () => void): void => {
      listener();
    });
  };
  const initializeFromStorage = (): void => {
    if (didInit) {
      return;
    }
    didInit = true;
    preference = loadPreferenceFromStorage();
    snapshot = { preference };
    emit();
  };
  const reloadFromStorage = (): void => {
    preference = loadPreferenceFromStorage();
    snapshot = { preference };
    emit();
  };
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return (): void => {
      listeners.delete(listener);
    };
  };
  const getSnapshot = (): ThemeSnapshot => snapshot;
  const setPreference = (next: ThemePreference): void => {
    if (preference === next) {
      return;
    }
    preference = next;
    snapshot = { preference };
    savePreferenceToStorage(next);
    emit();
  };
  return { subscribe, getSnapshot, setPreference, initializeFromStorage, reloadFromStorage };
};

const store: ThemeStore = createStore();

type UseThemeResult = Readonly<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}>;

const useTheme = (): UseThemeResult => {
  const getServerSnapshot = (): ThemeSnapshot => SERVER_SNAPSHOT;
  const snapshot: ThemeSnapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);

  useEffect(() => {
    store.initializeFromStorage();
    if (typeof window === "undefined") return;
    const onProfileChanged = (): void => {
      store.reloadFromStorage();
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
    return (): void => {
      window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
    };
  }, []);
  const setPreference = useCallback((preference: ThemePreference): void => {
    store.setPreference(preference);
  }, []);
  return { preference: snapshot.preference, setPreference };
};

export { useTheme };
const getStorageKey = (): string => getScopedStorageKey(STORAGE_KEY);
