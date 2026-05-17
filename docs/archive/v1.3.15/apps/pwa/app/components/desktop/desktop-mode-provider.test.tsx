import React from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopModeProvider } from "./desktop-mode-provider";

const desktopModeProviderMocks = vi.hoisted(() => ({
  isDesktop: true,
}));

vi.mock("@/app/features/desktop/hooks/use-tauri", () => ({
  useIsDesktop: () => desktopModeProviderMocks.isDesktop,
}));

describe("DesktopModeProvider", () => {
  afterEach(() => {
    document.body.classList.remove("desktop-mode");
    document.documentElement.classList.remove("desktop-mode");
    const styleEl = document.getElementById("desktop-mode-styles");
    if (styleEl) {
      styleEl.remove();
    }
  });

  it("enables desktop mode without forcing global text selection", () => {
    const view = render(
      <DesktopModeProvider>
        <div>child</div>
      </DesktopModeProvider>,
    );

    expect(document.body.classList.contains("desktop-mode")).toBe(true);
    expect(document.documentElement.classList.contains("desktop-mode")).toBe(true);

    const styleEl = document.getElementById("desktop-mode-styles");
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent ?? "").toContain(".desktop-mode .pwa-install-prompt");
    expect(styleEl?.textContent ?? "").not.toContain("user-select: text");

    view.unmount();
    expect(document.body.classList.contains("desktop-mode")).toBe(false);
    expect(document.documentElement.classList.contains("desktop-mode")).toBe(false);
    expect(document.getElementById("desktop-mode-styles")).toBeNull();
  });
});

