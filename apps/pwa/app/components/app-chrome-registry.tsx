"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

/** Serializable chrome flags only — never register React nodes here (use ChatSidebarPortal). */
export type AppChromeSlot = Readonly<{
  navBadgeCounts: Readonly<Record<string, number>>;
  hideSidebar: boolean;
  hideHeader: boolean;
  mobileDmMode: boolean;
}>;

export type AppChromeOverrides = Partial<AppChromeSlot>;

const DEFAULT_APP_CHROME_SLOT: AppChromeSlot = {
  navBadgeCounts: {},
  hideSidebar: false,
  hideHeader: false,
  mobileDmMode: false,
};

type AppChromeRegistryContextValue = Readonly<{
  mergedSlot: AppChromeSlot;
  upsert: (id: string, overrides: AppChromeOverrides) => void;
  remove: (id: string) => void;
}>;

const AppChromeRegistryContext = createContext<AppChromeRegistryContextValue | null>(null);

export function navBadgeCountsEqual(
  left: Readonly<Record<string, number>> | undefined,
  right: Readonly<Record<string, number>> | undefined,
): boolean {
  const a = left ?? {};
  const b = right ?? {};
  const leftKeys = Object.keys(a);
  const rightKeys = Object.keys(b);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => a[key] === b[key]);
}

export function appChromeOverridesEqual(
  left: AppChromeOverrides | undefined,
  right: AppChromeOverrides,
): boolean {
  const previous = left ?? {};
  return (
    navBadgeCountsEqual(previous.navBadgeCounts, right.navBadgeCounts)
    && (previous.hideSidebar ?? false) === (right.hideSidebar ?? false)
    && (previous.hideHeader ?? false) === (right.hideHeader ?? false)
    && (previous.mobileDmMode ?? false) === (right.mobileDmMode ?? false)
  );
}

export function mergeAppChromeSlots(
  entries: ReadonlyArray<AppChromeOverrides>,
): AppChromeSlot {
  let navBadgeCounts: Record<string, number> = {};
  let hideSidebar = DEFAULT_APP_CHROME_SLOT.hideSidebar;
  let hideHeader = DEFAULT_APP_CHROME_SLOT.hideHeader;
  let mobileDmMode = DEFAULT_APP_CHROME_SLOT.mobileDmMode;

  for (const partial of entries) {
    if (partial.navBadgeCounts) {
      navBadgeCounts = { ...navBadgeCounts, ...partial.navBadgeCounts };
    }
    if (partial.hideSidebar !== undefined) {
      hideSidebar = partial.hideSidebar;
    }
    if (partial.hideHeader !== undefined) {
      hideHeader = partial.hideHeader;
    }
    if (partial.mobileDmMode !== undefined) {
      mobileDmMode = partial.mobileDmMode;
    }
  }

  return { navBadgeCounts, hideSidebar, hideHeader, mobileDmMode };
}

function pickSerializableOverrides(overrides: AppChromeOverrides): AppChromeOverrides {
  const picked: {
    navBadgeCounts?: Readonly<Record<string, number>>;
    hideSidebar?: boolean;
    hideHeader?: boolean;
    mobileDmMode?: boolean;
  } = {};
  if (overrides.navBadgeCounts !== undefined) {
    picked.navBadgeCounts = overrides.navBadgeCounts;
  }
  if (overrides.hideSidebar !== undefined) {
    picked.hideSidebar = overrides.hideSidebar;
  }
  if (overrides.hideHeader !== undefined) {
    picked.hideHeader = overrides.hideHeader;
  }
  if (overrides.mobileDmMode !== undefined) {
    picked.mobileDmMode = overrides.mobileDmMode;
  }
  return picked;
}

export function serializeAppChromeOverrides(overrides: AppChromeOverrides): string {
  const picked = pickSerializableOverrides(overrides);
  return JSON.stringify({
    navBadgeCounts: picked.navBadgeCounts ?? {},
    hideSidebar: picked.hideSidebar ?? false,
    hideHeader: picked.hideHeader ?? false,
    mobileDmMode: picked.mobileDmMode ?? false,
  });
}

export function AppChromeProvider(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const [entries, setEntries] = useState<ReadonlyMap<string, AppChromeOverrides>>(() => new Map());

  const upsert = useCallback((id: string, overrides: AppChromeOverrides): void => {
    const nextOverrides = pickSerializableOverrides(overrides);
    setEntries((previous) => {
      const existing = previous.get(id);
      if (existing && appChromeOverridesEqual(existing, nextOverrides)) {
        return previous;
      }
      const next = new Map(previous);
      next.set(id, nextOverrides);
      return next;
    });
  }, []);

  const remove = useCallback((id: string): void => {
    setEntries((previous) => {
      if (!previous.has(id)) {
        return previous;
      }
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  }, []);

  const mergedSlot = useMemo((): AppChromeSlot => {
    return mergeAppChromeSlots([...entries.values()]);
  }, [entries]);

  const value = useMemo(
    (): AppChromeRegistryContextValue => ({ mergedSlot, upsert, remove }),
    [mergedSlot, upsert, remove],
  );

  return (
    <AppChromeRegistryContext.Provider value={value}>
      {props.children}
    </AppChromeRegistryContext.Provider>
  );
}

function useAppChromeRegistry(): AppChromeRegistryContextValue {
  const context = useContext(AppChromeRegistryContext);
  if (!context) {
    throw new Error("useAppChromeRegistry must be used within AppChromeProvider");
  }
  return context;
}

/** Route-scoped chrome flags; registration removed only on unmount (not on every prop change). */
export function useRegisterAppChrome(overrides: AppChromeOverrides): void {
  const id = useId();
  const { upsert, remove } = useAppChromeRegistry();
  const serialized = serializeAppChromeOverrides(overrides);

  useEffect(() => {
    return () => remove(id);
  }, [id, remove]);

  useEffect(() => {
    upsert(id, pickSerializableOverrides(overrides));
    // Depend on serialized flags only — `overrides` is a new object reference most renders.
  }, [id, upsert, serialized]);
}

export function useAppChromeMergedSlot(): AppChromeSlot {
  return useAppChromeRegistry().mergedSlot;
}
