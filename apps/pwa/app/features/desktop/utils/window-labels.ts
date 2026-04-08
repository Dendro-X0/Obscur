export const INCOMING_CALL_POPUP_WINDOW_LABEL = "incoming-call-popup";

type TauriMetadataWindow = Readonly<{ label?: unknown }>;
type TauriMetadata = Readonly<{ currentWindow?: TauriMetadataWindow }>;
type TauriInternals = Readonly<{ metadata?: TauriMetadata }>;

export const getCurrentDesktopWindowLabel = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const internals = (window as Window & { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  const candidate = internals?.metadata?.currentWindow?.label;
  if (typeof candidate !== "string") {
    return null;
  }
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
};

const hasIncomingCallPopupQueryFlag = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return new URL(window.location.href).searchParams.get("incomingCallPopup") === "1";
  } catch {
    return false;
  }
};

export const isIncomingCallPopupWindow = (): boolean => (
  getCurrentDesktopWindowLabel() === INCOMING_CALL_POPUP_WINDOW_LABEL
  || hasIncomingCallPopupQueryFlag()
);
