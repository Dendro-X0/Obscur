import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunityInviteAvatar } from "./community-invite-avatar";

describe("CommunityInviteAvatar", () => {
    it("renders initial when no picture is provided", () => {
        render(<CommunityInviteAvatar displayName="Test 8" />);
        expect(screen.getByText("T")).toBeInTheDocument();
    });

    it("renders image when picture url is provided", () => {
        const { container } = render(
            <CommunityInviteAvatar
                displayName="Test 8"
                pictureUrl="https://example.com/avatar.png"
            />,
        );
        const img = container.querySelector("img");
        expect(img).not.toBeNull();
        expect(img?.getAttribute("src")).toContain("avatar.png");
    });
});
