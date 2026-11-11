/**
 * Cut 4.3 — shared lab vs native selection for Vite desktop-ui adapters.
 * Lab stubs only when OBSCUR_DESKTOP_UI_LAB_STUBS=1 or Tauri host absent.
 */

export type DesktopUiAdapterSource = "lab" | "native";

export type DesktopUiAdapterSelectionParams = Readonly<{
  isNativeRuntime: boolean;
  /** Explicit CI/lab force — OBSCUR_DESKTOP_UI_LAB_STUBS=1 */
  forceLabStubs?: boolean;
}>;

export const shouldUseDesktopUiLabStubs = (
  params: DesktopUiAdapterSelectionParams,
): boolean => params.forceLabStubs === true || !params.isNativeRuntime;

export const resolveDesktopUiAdapterSource = (
  params: DesktopUiAdapterSelectionParams,
): DesktopUiAdapterSource => (
  shouldUseDesktopUiLabStubs(params) ? "lab" : "native"
);

export const readDesktopUiLabStubsForced = (
  envValue: string | undefined = typeof import.meta !== "undefined"
    ? import.meta.env?.OBSCUR_DESKTOP_UI_LAB_STUBS
    : undefined,
): boolean => envValue === "1";

/** Detect Tauri host without importing engine-host (keeps unit tests light). */
export const detectDesktopUiNativeRuntime = (
  win: Window | undefined = typeof window !== "undefined" ? window : undefined,
): boolean => {
  if (!win) {
    return false;
  }
  const w = win as Window & {
    __TAURI_INTERNALS__?: { invoke?: unknown };
    __TAURI__?: { core?: { invoke?: unknown } };
  };
  return (
    typeof w.__TAURI_INTERNALS__?.invoke === "function"
    || typeof w.__TAURI__?.core?.invoke === "function"
  );
};
