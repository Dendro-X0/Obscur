import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteWarmupSkeleton } from "./route-warmup-skeleton";

describe("RouteWarmupSkeleton (X1)", () => {
  it("renders route-specific loading status", () => {
    render(
      <RouteWarmupSkeleton
        title="Loading settings"
        detail="Opening preferences"
        surface="settings"
      />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading settings")).toBeTruthy();
    expect(screen.getByText("Opening preferences")).toBeTruthy();
  });

  it("derives surface from pathname", () => {
    const { container } = render(
      <RouteWarmupSkeleton pathname="/vault" title="Vault" detail="Indexing media" />,
    );

    expect(container.querySelector(".grid-cols-2")).toBeTruthy();
  });
});
