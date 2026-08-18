import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppOverlayRoot, APP_OVERLAY_ROOT_ID } from "@/app/components/app-overlay-layer";
import { IdentityBindingAcceptDialog } from "./identity-binding-accept-dialog";
import en from "@/app/lib/i18n/locales/en.json";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => (en.translation as Record<string, string | undefined>)[key] ?? key,
  }),
}));

const BINDING = {
  displayName: "DemoUser",
  npubFragment: "npub1sc9…xqx19e8s",
  resolvedViaLabel: "Incoming connection request",
  resolvedViaDetail: "8b8b1bc3…e87b7c8c",
  avatarUrl: null,
  literacyNote: null,
} as const;

describe("IdentityBindingAcceptDialog overlay stack", () => {
  it("portals above app shell sidebar stacking context", () => {
    render(
      <>
        <AppOverlayRoot />
        <IdentityBindingAcceptDialog
          isOpen
          binding={BINDING}
          onClose={() => undefined}
          onConfirm={() => undefined}
        />
      </>,
    );

    const overlayRoot = document.getElementById(APP_OVERLAY_ROOT_ID);
    const dialog = screen.getByTestId("identity-binding-accept-dialog");
    const backdrop = overlayRoot?.querySelector('[data-testid="identity-binding-accept-dialog-backdrop"]');

    expect(overlayRoot?.contains(dialog)).toBe(true);
    expect(backdrop?.className).toContain("z-[10100]");
    expect(backdrop?.className).toContain("fixed");
    expect(backdrop?.className).toContain("inset-0");
  });
});
