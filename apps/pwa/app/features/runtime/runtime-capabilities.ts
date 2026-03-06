export type RuntimeCapabilities = Readonly<{
  isNativeRuntime: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  supportsNativeCrypto: boolean;
  supportsWindowControls: boolean;
  supportsNativeNotifications: boolean;
  supportsTor: boolean;
}>;

const isWindowDefined = (): boolean => typeof window !== "undefined";

const hasTauriSignals = (): boolean => {
  if (!isWindowDefined()) return false;
  const w = window as Window & {
    __TAURI__?: { core?: { invoke?: unknown } };
    __TAURI_INTERNALS__?: { invoke?: unknown };
    __TAURI_IPC__?: unknown;
  };
  const hasCallableBridge =
    typeof w.__TAURI_INTERNALS__?.invoke === "function" ||
    typeof w.__TAURI__?.core?.invoke === "function" ||
    typeof w.__TAURI_IPC__ === "function";
  // Treat runtime as native only when we can actually invoke the bridge.
  // This prevents web/PWA false positives that cause noisy command failures.
  return hasCallableBridge;
};

const isLikelyNativeMobile = (): boolean => {
  if (!isWindowDefined()) return false;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const w = window as Window & { __TAURI_INTERNALS__?: { metadata?: { mobile?: boolean } } };
  return !!w.__TAURI_INTERNALS__?.metadata?.mobile || /\bAndroid\b|\biPhone\b|\biPad\b/i.test(ua);
};

export const getRuntimeCapabilities = (): RuntimeCapabilities => {
  const native = hasTauriSignals();
  const mobile = native && isLikelyNativeMobile();
  const desktop = native && !mobile;
  return {
    isNativeRuntime: native,
    isDesktop: desktop,
    isMobile: mobile,
    supportsNativeCrypto: native,
    supportsWindowControls: desktop,
    supportsNativeNotifications: native,
    supportsTor: desktop,
  };
};

export const hasNativeRuntime = (): boolean => getRuntimeCapabilities().isNativeRuntime;
