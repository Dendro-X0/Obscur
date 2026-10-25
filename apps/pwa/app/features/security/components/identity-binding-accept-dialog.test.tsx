import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { APP_OVERLAY_PORTAL_WRAPPER_CLASS } from "@/app/components/app-overlay-layer";
import { IdentityBindingAcceptDialog } from "./identity-binding-accept-dialog";
import type { IdentityBindingViewModel } from "@/app/features/security/services/identity-binding-presenter";
import en from "@/app/lib/i18n/locales/en.json";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => (en.translation as Record<string, string | undefined>)[key] ?? key,
  }),
}));

const BINDING: IdentityBindingViewModel = {
  publicKeyHex: "a".repeat(64) as IdentityBindingViewModel["publicKeyHex"],
  npub: "npub1sc9examplexqx19e8s",
  npubFragment: "npub1sc9…xqx19e8s",
  hexFragment: "aaaaaaaa…aaaaaaaa",
  displayName: "DemoUser",
  displayNameUntrusted: false,
  resolverSource: "connection_request",
  friendCode: null,
  avatarUrl: null,
  confidence: "direct",
};

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
