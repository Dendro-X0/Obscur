import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { APP_OVERLAY_PORTAL_WRAPPER_CLASS } from "@/app/components/app-overlay-layer";
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
      <IdentityBindingAcceptDialog
        isOpen
        binding={BINDING}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    const portal = document.body.querySelector('[data-testid="app-overlay-portal"]');
    const dialog = screen.getByTestId("identity-binding-accept-dialog");
    const backdrop = screen.getByTestId("identity-binding-accept-dialog-backdrop");

    expect(document.body.contains(dialog)).toBe(true);
    expect(portal?.className).toContain(APP_OVERLAY_PORTAL_WRAPPER_CLASS);
    expect(backdrop.className).toContain("bg-black/75");
  });
});
