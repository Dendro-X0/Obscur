export type RuntimeCapabilities = Readonly<{
  isNativeRuntime: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  supportsNativeCrypto: boolean;
  supportsWindowControls: boolean;
  supportsNativeNotifications: boolean;
  supportsTor: boolean;
}>;

export type RuntimeHostInfo = Readonly<{
  hostname: string | null;
  isLocalDevelopment: boolean;
  isHostedPreview: boolean;
}>;

export type RuntimeShellInfo = Readonly<{
  isStandalonePwa: boolean;
}>;

const isWindowDefined = (): boolean => typeof window !== "undefined";

const getHostnameSafe = (): string | null => {
  if (!isWindowDefined()) return null;
  return window.location?.hostname ?? null;
};

const classifyRuntimeHost = (hostname: string | null): RuntimeHostInfo => {
  const normalized = (hostname ?? "").toLowerCase();
  return {
    hostname,
    isLocalDevelopment: normalized === "localhost" || normalized === "127.0.0.1",
    isHostedPreview: normalized.includes("vercel.app"),
  };
};

export const hasCallableNativeBridge = (): boolean => {
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
  const native = hasCallableNativeBridge();
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

export const getRuntimeHostInfo = (): RuntimeHostInfo => {
  return classifyRuntimeHost(getHostnameSafe());
};

const getStandalonePwaSafe = (): boolean => {
  if (!isWindowDefined()) return false;
  const navigatorStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayModeStandalone =
    typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return navigatorStandalone || displayModeStandalone;
};

export const getRuntimeShellInfo = (): RuntimeShellInfo => ({
  isStandalonePwa: getStandalonePwaSafe(),
});

export const shouldAutoEnableDefaultUploadProviders = (): boolean => {
  const host = getRuntimeHostInfo();
  return hasNativeRuntime() || host.isLocalDevelopment || host.isHostedPreview;
};

export const runtimeCapabilitiesInternals = {
  classifyRuntimeHost,
  getStandalonePwaSafe,
};
