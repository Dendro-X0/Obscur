/**
 * Dev Lab — in-app testing module policy.
 * Enabled in non-production builds or when NEXT_PUBLIC_OBSCUR_DEV_LAB=1.
 */

export const DEV_LAB_VERSION = "obscur.dev-lab.v1";

declare global {
  interface Window {
    __OBSCUR_DEV_LAB__?: boolean;
  }
}

export const isDevLabEnabled = (): boolean => {
  if (typeof window !== "undefined" && window.__OBSCUR_DEV_LAB__ === true) {
    return true;
  }
  if (process.env.NEXT_PUBLIC_OBSCUR_DEV_LAB === "1") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
};

export const markDevLabBootFlag = (): void => {
  if (typeof window === "undefined" || !isDevLabEnabled()) {
    return;
  }
  window.__OBSCUR_DEV_LAB__ = true;
};
