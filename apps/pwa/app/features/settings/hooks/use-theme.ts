"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { PROFILE_CHANGED_EVENT } from "@/app/features/profiles/services/profile-registry-service";
import { readActiveDesktopProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/app/features/settings/services/ui-preferences-persistence";

type ThemeSnapshot = Readonly<{
  preference: ThemePreference;
}>;

type ThemeStore = Readonly<{
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ThemeSnapshot;
  setPreference: (preference: ThemePreference) => void;
  hydrateFromStorage: (profileId?: string) => void;
}>;

const SERVER_SNAPSHOT: ThemeSnapshot = { preference: "system" };

const createStore = (): ThemeStore => {
  const listeners: Set<() => void> = new Set<() => void>();
  let preference: ThemePreference = typeof window !== "undefined"
    ? loadThemePreference(readActiveDesktopProfileId())
    : "system";
  let snapshot: ThemeSnapshot = { preference };
  const emit = (): void => {
    listeners.forEach((listener: () => void): void => {
      listener();
    });
  };
  const hydrateFromStorage = (profileId?: string): void => {
    const next = loadThemePreference(profileId);
    if (preference === next && snapshot.preference === next) {
      return;
    }
    preference = next;
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
      saveThemePreference(next, getResolvedProfileId());
      return;
    }
    preference = next;
    snapshot = { preference };
    saveThemePreference(next, getResolvedProfileId());
    emit();
  };
  return { subscribe, getSnapshot, setPreference, hydrateFromStorage };
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
    store.hydrateFromStorage(getResolvedProfileId());
    if (typeof window === "undefined") {
      return;
    }
    const onProfileChanged = (event: Event): void => {
      const detail = (event as CustomEvent<{ activeProfileId?: string }>).detail;
      const profileId = typeof detail?.activeProfileId === "string"
        ? detail.activeProfileId
        : getResolvedProfileId();
      store.hydrateFromStorage(profileId);
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
    const resyncTimer = window.setTimeout(() => {
      store.hydrateFromStorage(getResolvedProfileId());
    }, 0);
    return (): void => {
      window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
      window.clearTimeout(resyncTimer);
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference): void => {
    store.setPreference(next);
  }, []);

  return { preference: snapshot.preference, setPreference };
};

export { useTheme };
export type { ThemePreference };
