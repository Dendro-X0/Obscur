import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunityInviteResponseCard } from "./community-invite-response-card";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe("CommunityInviteResponseCard", () => {
  it("renders compact status banner on mobile layout", () => {
    render(
      <CommunityInviteResponseCard
        response={{ type: "community-invite-response", status: "accepted", groupId: "g1" }}
        viewerRole="invitee"
        compact
      />,
    );

    expect(screen.getByTestId("community-invite-response-card")).toBeInTheDocument();
    expect(screen.getByTestId("community-invite-status-banner")).toBeInTheDocument();
  });
});
