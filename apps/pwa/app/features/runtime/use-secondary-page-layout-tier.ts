"use client";

import { useSyncExternalStore } from "react";
import type { SecondaryPageLayoutTier } from "./use-secondary-page-layout-tier.snapshot";
import {
  getSecondaryPageLayoutTierSnapshot,
  getMobileCompactLayoutSnapshot,
  getTabletSecondaryLayoutSnapshot,
  getMobileThreadCompactCardsSnapshot,
} from "./use-secondary-page-layout-tier.snapshot";

const LAYOUT_TIER_MEDIA_QUERIES = ["(max-width: 639px)", "(min-width: 640px)", "(max-width: 1023px)"] as const;

const subscribeSecondaryPageLayoutTier = (onStoreChange: () => void): (() => void) => {
  if (typeof window === "undefined") {
    return (): void => {};
  }
  const mediaQueryLists = LAYOUT_TIER_MEDIA_QUERIES.map((query) => window.matchMedia(query));
  const handleChange = (): void => {
    onStoreChange();
  };
  mediaQueryLists.forEach((mediaQuery) => {
    mediaQuery.addEventListener("change", handleChange);
  });
  return (): void => {
    mediaQueryLists.forEach((mediaQuery) => {
      mediaQuery.removeEventListener("change", handleChange);
    });
  };
};

const getServerLayoutTier = (): SecondaryPageLayoutTier => getSecondaryPageLayoutTierSnapshot();

/** Phone / tablet / desktop tier for secondary routes (settings, network, vault, group home). */
export function useSecondaryPageLayoutTier(): SecondaryPageLayoutTier {
  return useSyncExternalStore(
    subscribeSecondaryPageLayoutTier,
    getSecondaryPageLayoutTierSnapshot,
    getServerLayoutTier,
  );
}

/** Narrow phone layout — not tablet or desktop widths. */
export function useMobileCompactLayout(): boolean {
  return useSyncExternalStore(
    subscribeSecondaryPageLayoutTier,
    getMobileCompactLayoutSnapshot,
    () => getMobileCompactLayoutSnapshot(),
  );
}

/** Tablet-width secondary pages (e.g. iPad portrait) — between phone compact and desktop. */
export function useTabletSecondaryLayout(): boolean {
  return useSyncExternalStore(
    subscribeSecondaryPageLayoutTier,
    getTabletSecondaryLayoutSnapshot,
    () => false,
  );
}

/** True when thread cards should use full-width phone compact styling. */
export function useMobileThreadCompactCards(): boolean {
  return useSyncExternalStore(
    subscribeSecondaryPageLayoutTier,
    getMobileThreadCompactCardsSnapshot,
    () => getMobileThreadCompactCardsSnapshot(),
  );
}
