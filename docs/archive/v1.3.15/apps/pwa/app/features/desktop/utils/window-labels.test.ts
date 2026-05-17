import { describe, expect, it } from "vitest";
import { getCurrentDesktopWindowLabel, INCOMING_CALL_POPUP_WINDOW_LABEL, isIncomingCallPopupWindow } from "./window-labels";

describe("window-labels", () => {
  it("reads current window label from tauri metadata when present", () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {
        metadata: {
          currentWindow: {
            label: INCOMING_CALL_POPUP_WINDOW_LABEL,
          },
        },
      },
    });
    expect(getCurrentDesktopWindowLabel()).toBe(INCOMING_CALL_POPUP_WINDOW_LABEL);
    expect(isIncomingCallPopupWindow()).toBe(true);
  });

  it("treats incomingCallPopup query as popup fallback when label metadata is unavailable", () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: undefined,
    });
    window.history.replaceState({}, "", "/?incomingCallPopup=1");
    expect(getCurrentDesktopWindowLabel()).toBeNull();
    expect(isIncomingCallPopupWindow()).toBe(true);
  });
});
