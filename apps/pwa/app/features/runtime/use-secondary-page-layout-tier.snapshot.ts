import { isDesktopShellProduct, isMobileShellProduct } from "@/app/features/runtime/shell-contract";

export type SecondaryPageLayoutTier = "phone" | "tablet" | "desktop";

const PHONE_MAX_QUERY = "(max-width: 639px)";
const TABLET_RANGE_QUERY = "(min-width: 640px) and (max-width: 1023px)";

export const getSecondaryPageLayoutTierSnapshot = (): SecondaryPageLayoutTier => {
  if (isDesktopShellProduct()) {
    return "desktop";
  }
  if (typeof window === "undefined") {
    return isMobileShellProduct() ? "phone" : "desktop";
  }
  if (window.matchMedia(PHONE_MAX_QUERY).matches) {
    return "phone";
  }
  if (window.matchMedia(TABLET_RANGE_QUERY).matches) {
    return "tablet";
  }
  return "desktop";
};

export const getMobileCompactLayoutSnapshot = (): boolean => (
  getSecondaryPageLayoutTierSnapshot() === "phone"
);

export const getTabletSecondaryLayoutSnapshot = (): boolean => (
  getSecondaryPageLayoutTierSnapshot() === "tablet"
);

export const getMobileThreadCompactCardsSnapshot = (): boolean => (
  getSecondaryPageLayoutTierSnapshot() === "phone"
);
