import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";

const COARSE_POINTER_QUERY = "(pointer: coarse)";

export const getPreferNativeTouchScrollSnapshot = (): boolean => {
  if (typeof window === "undefined") {
    return isMobileShellProduct();
  }
  return isMobileShellProduct() || window.matchMedia(COARSE_POINTER_QUERY).matches;
};
