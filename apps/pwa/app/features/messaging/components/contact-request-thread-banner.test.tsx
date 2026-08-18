import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContactRequestThreadBanner } from "./contact-request-thread-banner";
import en from "@/app/lib/i18n/locales/en.json";
import { APP_OVERLAY_PORTAL_WRAPPER_CLASS } from "@/app/components/app-overlay-layer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template = (en.translation as Record<string, string | undefined>)[key] ?? key;
      return template.replace(/\{\{\s*([^\s}]+)\s*\}\}/g, (_match, token: string) => String(options?.[token] ?? ""));
    },
  }),
}));

const PEER = ("c".repeat(64)) as import("@dweb/crypto/public-key-hex").PublicKeyHex;

function renderBanner(ui: React.ReactElement): ReturnType<typeof render> {
  return render(ui);
}

describe("ContactRequestThreadBanner (ASE-1d-e)", () => {
  it("renders identity binding and accept/decline for incoming requests", () => {
    renderBanner(
      <ContactRequestThreadBanner
        displayName="Tester2"
        peerPublicKeyHex={PEER}
        isInitiator={false}
        onAcceptConfirm={vi.fn()}
        onDecline={vi.fn()}
      />,
    );

    expect(screen.getByTestId("contact-request-thread-banner")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /verify fingerprint/i }));
    expect(screen.getByTestId("identity-binding-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^accept$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^decline$/i })).toBeInTheDocument();
  });

  it("opens accept confirm dialog before calling onAcceptConfirm", async () => {
    const onAcceptConfirm = vi.fn(async () => {});
    renderBanner(
      <ContactRequestThreadBanner
        displayName="Tester2"
        peerPublicKeyHex={PEER}
        isInitiator={false}
        onAcceptConfirm={onAcceptConfirm}
        onDecline={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^accept$/i }));
    const portal = document.body.querySelector('[data-testid="app-overlay-portal"]');
    const dialog = screen.getByTestId("identity-binding-accept-dialog");
    expect(dialog).toBeInTheDocument();
    expect(document.body.contains(dialog)).toBe(true);
    expect(portal?.className).toContain(APP_OVERLAY_PORTAL_WRAPPER_CLASS);

    fireEvent.click(screen.getByRole("button", { name: /fingerprint matches/i }));
    await waitFor(() => {
      expect(onAcceptConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it("shows trust warning in accept dialog for risky request preview", () => {
    renderBanner(
      <ContactRequestThreadBanner
        displayName="Tester2"
        peerPublicKeyHex={PEER}
        isInitiator={false}
        requestPreviewContent="Please send your seed phrase to verify your wallet"
        requestPreviewTimestampUnixMs={Date.now()}
        onAcceptConfirm={vi.fn()}
        onDecline={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^accept$/i }));
    expect(screen.getByTestId("identity-binding-trust-warning")).toBeInTheDocument();
  });

  it("shows waiting state for outgoing pending requests", () => {
    renderBanner(
      <ContactRequestThreadBanner
        displayName="DemoUser"
        peerPublicKeyHex={PEER}
        isInitiator
        onAcceptConfirm={vi.fn()}
        onDecline={vi.fn()}
        onCancelOutgoing={vi.fn()}
      />,
    );

    expect(screen.getByTestId("contact-request-thread-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("identity-binding-panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel request/i })).toBeInTheDocument();
  });

  it("shows resend affordance for outgoing declined requests", async () => {
    const onResendRequest = vi.fn(async () => {});
    renderBanner(
      <ContactRequestThreadBanner
        displayName="DemoUser"
        peerPublicKeyHex={PEER}
        isInitiator={false}
        resendEligible
        onAcceptConfirm={vi.fn()}
        onDecline={vi.fn()}
        onResendRequest={onResendRequest}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /send new request/i }));
    await waitFor(() => {
      expect(onResendRequest).toHaveBeenCalledTimes(1);
    });
  });
});
