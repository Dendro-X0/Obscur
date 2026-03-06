"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

type TextScale = 90 | 100 | 110 | 120;

type AccessibilityPreferences = Readonly<{
  textScale: TextScale;
  reducedMotion: boolean;
  contrastAssist: boolean;
}>;

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

const STORAGE_KEY: string = "dweb.nostr.pwa.ui.accessibility.v1";
const SERVER_SNAPSHOT: AccessibilitySnapshot = {
  preferences: { textScale: 100, reducedMotion: false, contrastAssist: false }
};

const isTextScale = (value: unknown): value is TextScale =>
  value === 90 || value === 100 || value === 110 || value === 120;

const parsePreferences = (value: unknown): AccessibilityPreferences | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<AccessibilityPreferences>;
  const textScale = isTextScale(candidate.textScale) ? candidate.textScale : 100;
  const reducedMotion = typeof candidate.reducedMotion === "boolean" ? candidate.reducedMotion : false;
  const contrastAssist = typeof candidate.contrastAssist === "boolean" ? candidate.contrastAssist : false;
  return { textScale, reducedMotion, contrastAssist };
};

const loadPreferencesFromStorage = (): AccessibilityPreferences => {
  if (typeof window === "undefined") {
    return SERVER_SNAPSHOT.preferences;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return SERVER_SNAPSHOT.preferences;
    }
    const parsed = parsePreferences(JSON.parse(raw));
    return parsed ?? SERVER_SNAPSHOT.preferences;
  } catch {
    return SERVER_SNAPSHOT.preferences;
  }
};

const savePreferencesToStorage = (preferences: AccessibilityPreferences): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    return;
  }
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
    savePreferencesToStorage(preferences);
    emit();
  };

  const initializeFromStorage = (): void => {
    if (didInit) {
      return;
    }
    didInit = true;
    preferences = loadPreferencesFromStorage();
    snapshot = { preferences };
    emit();
  };

  const reloadFromStorage = (): void => {
    preferences = loadPreferencesFromStorage();
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
    reloadFromStorage
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
      if (event.key !== STORAGE_KEY) return;
      store.reloadFromStorage();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
    reset
  };
};

export type { TextScale, AccessibilityPreferences };
export { useAccessibilityPreferences };
