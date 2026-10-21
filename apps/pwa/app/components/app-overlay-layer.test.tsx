import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  APP_OVERLAY_PORTAL_WRAPPER_CLASS,
  AppOverlayPortal,
} from "./app-overlay-layer";

describe("AppOverlayPortal (Tauri desktop shell)", () => {
  it("portals overlays to document.body outside desktop-window-glow", () => {
    render(
      <AppOverlayPortal>
        <div data-testid="overlay-child">Overlay content</div>
      </AppOverlayPortal>,
    );

    const portal = document.body.querySelector('[data-testid="app-overlay-portal"]');
    const child = screen.getByTestId("overlay-child");

    expect(portal).not.toBeNull();
    expect(document.body.contains(child)).toBe(true);
    expect(portal?.className).toContain(APP_OVERLAY_PORTAL_WRAPPER_CLASS);
    expect(portal?.className).toContain("z-[10100]");
  });
});
