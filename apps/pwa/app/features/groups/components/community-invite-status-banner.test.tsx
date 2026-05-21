import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunityInviteStatusBanner } from "./community-invite-status-banner";

describe("CommunityInviteStatusBanner", () => {
    it("renders accepted status for outgoing with amber relay-honest shell", () => {
        render(<CommunityInviteStatusBanner status="accepted" isOutgoing />);
        const banner = screen.getByTestId("community-invite-status-banner");
        expect(banner).toHaveAttribute("data-invite-status", "accepted");
        expect(banner).toHaveAttribute("data-invite-direction", "outgoing");
        expect(banner.className).toContain("bg-black/40");
        expect(banner.className).toContain("text-amber-100");
        expect(screen.getByText(/acceptance recorded/i)).toBeInTheDocument();
        expect(screen.getByText(/relay membership may still be syncing/i)).toBeInTheDocument();
    });

    it("renders accepted status for incoming with amber contrast", () => {
        render(<CommunityInviteStatusBanner status="accepted" isOutgoing={false} />);
        const banner = screen.getByTestId("community-invite-status-banner");
        expect(banner).toHaveAttribute("data-invite-direction", "incoming");
        expect(banner.className).toContain("from-amber-50");
        expect(screen.getByText(/complete join below/i)).toBeInTheDocument();
    });

    it("renders declined outgoing with rose contrast", () => {
        render(<CommunityInviteStatusBanner status="declined" isOutgoing />);
        const banner = screen.getByTestId("community-invite-status-banner");
        expect(banner.className).toContain("text-rose-300");
        expect(screen.getByText(/they declined your invitation/i)).toBeInTheDocument();
    });
});
