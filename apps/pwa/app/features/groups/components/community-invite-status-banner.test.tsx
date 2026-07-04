import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunityInviteStatusBanner } from "./community-invite-status-banner";
import en from "@/app/lib/i18n/locales/en.json";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            const template = (en.translation as Record<string, string | undefined>)[key] ?? key;
            return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(options?.[token] ?? ""));
        },
    }),
}));

describe("CommunityInviteStatusBanner", () => {
    it("renders accepted status for outgoing with amber relay-honest shell", () => {
        render(<CommunityInviteStatusBanner status="accepted" isOutgoing />);
        const banner = screen.getByTestId("community-invite-status-banner");
        expect(banner).toHaveAttribute("data-invite-status", "accepted");
        expect(banner).toHaveAttribute("data-invite-direction", "outgoing");
        expect(banner.className).toContain("from-amber-50");
        expect(banner.className).toContain("text-amber-950");
        expect(screen.getByText(/acceptance recorded/i)).toBeInTheDocument();
        expect(screen.getByText(/participant lists come from relays and may lag/i)).toBeInTheDocument();
    });

    it("renders accepted status for incoming with amber contrast", () => {
        render(<CommunityInviteStatusBanner status="accepted" isOutgoing={false} />);
        const banner = screen.getByTestId("community-invite-status-banner");
        expect(banner).toHaveAttribute("data-invite-direction", "incoming");
        expect(banner.className).toContain("from-amber-50");
        expect(screen.getByText(/relay-backed membership can lag or fail/i)).toBeInTheDocument();
    });

    it("renders declined outgoing with rose contrast", () => {
        render(<CommunityInviteStatusBanner status="declined" isOutgoing />);
        const banner = screen.getByTestId("community-invite-status-banner");
        expect(banner.className).toContain("text-rose-900");
        expect(screen.getByText(/they declined your invitation/i)).toBeInTheDocument();
    });
});
