"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { PROFILE_CHANGED_EVENT } from "@/app/features/profiles/services/profile-registry-service";
import {
  getAccessibilityStorageKey,
  loadAccessibilityPreferences,
  resolveUiPreferencesProfileId,
  saveAccessibilityPreferences,
  type AccessibilityPreferencesSnapshot,
} from "@/app/features/settings/services/ui-preferences-persistence";

type TextScale = AccessibilityPreferencesSnapshot["textScale"];
type AccessibilityPreferences = AccessibilityPreferencesSnapshot;

type AccessibilitySnapshot = Readonly<{
  preferences: AccessibilityPreferences;
}>;

type AccessibilityStore = Readonly<{
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => AccessibilitySnapshot;
  setTextScale: (textScale: TextScale) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setContrastAssist: (contrastAssist: boolean) => void;
  initializeFromStorage: () => void;
  reloadFromStorage: () => void;
}>;

const SERVER_SNAPSHOT: AccessibilitySnapshot = {
  preferences: { textScale: 100, reducedMotion: false, contrastAssist: false },
};

const createStore = (): AccessibilityStore => {
  const listeners: Set<() => void> = new Set<() => void>();
  let didInit = false;
  let preferences: AccessibilityPreferences = SERVER_SNAPSHOT.preferences;
  let snapshot: AccessibilitySnapshot = { preferences };

  const emit = (): void => {
    listeners.forEach((listener) => listener());
  };

  const publish = (): void => {
    snapshot = { preferences };
    saveAccessibilityPreferences(preferences, resolveUiPreferencesProfileId());
    emit();
  };

  const initializeFromStorage = (): void => {
    if (didInit) {
      return;
    }
    didInit = true;
    preferences = loadAccessibilityPreferences(resolveUiPreferencesProfileId());
    snapshot = { preferences };
    emit();
  };

  const reloadFromStorage = (): void => {
    preferences = loadAccessibilityPreferences(resolveUiPreferencesProfileId());
    snapshot = { preferences };
    emit();
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    setTextScale: (textScale) => {
      if (preferences.textScale === textScale) return;
      preferences = { ...preferences, textScale };
      publish();
    },
    setReducedMotion: (reducedMotion) => {
      if (preferences.reducedMotion === reducedMotion) return;
      preferences = { ...preferences, reducedMotion };
      publish();
    },
    setContrastAssist: (contrastAssist) => {
      if (preferences.contrastAssist === contrastAssist) return;
      preferences = { ...preferences, contrastAssist };
      publish();
    },
    initializeFromStorage,
    reloadFromStorage,
  };
};

const store: AccessibilityStore = createStore();

type UseAccessibilityPreferencesResult = Readonly<{
  preferences: AccessibilityPreferences;
  setTextScale: (textScale: TextScale) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setContrastAssist: (contrastAssist: boolean) => void;
  reset: () => void;
}>;

const useAccessibilityPreferences = (): UseAccessibilityPreferencesResult => {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => SERVER_SNAPSHOT);

  useEffect(() => {
    store.initializeFromStorage();
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent): void => {
      const profileId = resolveUiPreferencesProfileId();
      const scopedKey = getAccessibilityStorageKey(profileId);
      if (event.key !== scopedKey && event.key !== "dweb.nostr.pwa.ui.accessibility.v1") {
        return;
      }
      store.reloadFromStorage();
    };
    window.addEventListener("storage", onStorage);
    const onProfileChanged = (): void => {
      store.reloadFromStorage();
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
    };
  }, []);

  const reset = useCallback((): void => {
    store.setTextScale(100);
    store.setReducedMotion(false);
    store.setContrastAssist(false);
  }, []);

  return {
    preferences: snapshot.preferences,
    setTextScale: store.setTextScale,
    setReducedMotion: store.setReducedMotion,
    setContrastAssist: store.setContrastAssist,
    reset,
  };
};

export type { TextScale, AccessibilityPreferences };
export { useAccessibilityPreferences };
