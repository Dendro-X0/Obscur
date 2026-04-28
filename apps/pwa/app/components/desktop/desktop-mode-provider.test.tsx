import React from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopModeProvider } from "./desktop-mode-provider";

const desktopModeProviderState = vi.hoisted(() => ({
  isDesktop: false,
}));

vi.mock("framer-motion", () => ({
  MotionConfig: ({ children }: Readonly<{ children: React.ReactNode }>) => <>{children}</>,
}));

vi.mock("@/app/features/desktop/hooks/use-tauri", () => ({
  useIsDesktop: () => desktopModeProviderState.isDesktop,
}));

describe("DesktopModeProvider", () => {
  afterEach(() => {
    document.body.classList.remove("desktop-mode", "desktop-safe-ui");
    document.documentElement.classList.remove("desktop-mode", "desktop-safe-ui");
    const styleEl = document.getElementById("desktop-mode-styles");
    if (styleEl) {
      styleEl.remove();
    }
    vi.unstubAllEnvs();
  });

  it("adds desktop and desktop-safe classes when desktop runtime is active", () => {
    desktopModeProviderState.isDesktop = true;

    render(
      <DesktopModeProvider>
        <div>content</div>
      </DesktopModeProvider>,
    );

    expect(document.body.classList.contains("desktop-mode")).toBe(true);
    expect(document.body.classList.contains("desktop-safe-ui")).toBe(true);
    expect(document.documentElement.classList.contains("desktop-mode")).toBe(true);
    expect(document.documentElement.classList.contains("desktop-safe-ui")).toBe(true);
  });

  it("leaves desktop classes off in web runtime", () => {
    desktopModeProviderState.isDesktop = false;

    render(
      <DesktopModeProvider>
        <div>content</div>
      </DesktopModeProvider>,
    );

    expect(document.body.classList.contains("desktop-mode")).toBe(false);
    expect(document.body.classList.contains("desktop-safe-ui")).toBe(false);
    expect(document.documentElement.classList.contains("desktop-mode")).toBe(false);
    expect(document.documentElement.classList.contains("desktop-safe-ui")).toBe(false);
  });
});
