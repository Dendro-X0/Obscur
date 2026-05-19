import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunityInviteStatusBanner } from "./community-invite-status-banner";

describe("CommunityInviteStatusBanner", () => {
    it("renders accepted status for outgoing with frosted shell", () => {
        render(<CommunityInviteStatusBanner status="accepted" isOutgoing />);
        const banner = screen.getByTestId("community-invite-status-banner");
        expect(banner).toHaveAttribute("data-invite-status", "accepted");
        expect(banner).toHaveAttribute("data-invite-direction", "outgoing");
        expect(banner.className).toContain("bg-black/40");
        expect(banner.className).toContain("text-emerald-300");
        expect(screen.getByText(/invitation accepted/i)).toBeInTheDocument();
        expect(screen.getByText(/relay membership syncs/i)).toBeInTheDocument();
    });

    it("renders accepted status for incoming with light-theme contrast", () => {
        render(<CommunityInviteStatusBanner status="accepted" isOutgoing={false} />);
        const banner = screen.getByTestId("community-invite-status-banner");
        expect(banner).toHaveAttribute("data-invite-direction", "incoming");
        expect(banner.className).toContain("from-emerald-50");
        expect(banner.className).toContain("text-emerald-900");
        expect(screen.getByText(/you joined this community/i)).toBeInTheDocument();
    });

    it("renders declined outgoing with rose contrast", () => {
        render(<CommunityInviteStatusBanner status="declined" isOutgoing />);
        const banner = screen.getByTestId("community-invite-status-banner");
        expect(banner.className).toContain("text-rose-300");
        expect(screen.getByText(/they declined your invitation/i)).toBeInTheDocument();
    });
});
