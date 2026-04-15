import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SearchResultCard } from "./search-result-card";
import type { DiscoveryResult } from "@/app/features/search/types/discovery";
import { getPublicProfileHref } from "@/app/features/navigation/public-routes";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/app/features/profile/hooks/use-resolved-profile-metadata", () => ({
  useResolvedProfileMetadata: () => ({
    displayName: "",
    avatarUrl: "",
    about: "",
    nip05: "",
  }),
}));

vi.mock("@/app/features/search/services/discovery-session-diagnostics", () => ({
  discoverySessionDiagnosticsStore: {
    recordAddContactConversion: vi.fn(),
  },
}));

const personResult: DiscoveryResult = {
  canonicalId: "a".repeat(64),
  kind: "person",
  display: {
    title: "Dendro-X0",
    pubkey: "a".repeat(64),
    description: "Find me on Obscur",
  },
  confidence: "direct",
  sources: ["local"],
  score: 100,
  freshnessUnixMs: Date.now(),
};

describe("SearchResultCard", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("routes a person card click to the public profile page by default", () => {
    render(<SearchResultCard result={personResult} />);

    fireEvent.click(screen.getAllByRole("button")[0]);

    expect(pushMock).toHaveBeenCalledWith(getPublicProfileHref(personResult.display.pubkey!));
  });

  it("routes the quick add action to the public profile page when no custom add handler is provided", () => {
    render(<SearchResultCard result={personResult} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);

    expect(pushMock).toHaveBeenCalledWith(getPublicProfileHref(personResult.display.pubkey!));
  });
});
