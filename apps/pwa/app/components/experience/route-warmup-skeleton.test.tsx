import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteWarmupSkeleton, SettingsPanelContentSkeleton } from "./route-warmup-skeleton";

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
    expect(screen.getByTestId("settings-skeleton-nav")).toBeTruthy();
  });

  it("derives surface from pathname", () => {
    const { container } = render(
      <RouteWarmupSkeleton pathname="/vault" title="Vault" detail="Indexing media" />,
    );

    expect(container.querySelector(".grid-cols-2")).toBeTruthy();
  });

  it("renders compact settings panel skeleton without chrome", () => {
    render(<SettingsPanelContentSkeleton />);
    expect(screen.getByTestId("settings-panel-content-skeleton")).toHaveAttribute("aria-busy", "true");
  });

  it("compactChrome keeps title/detail without a second Obscur brand", () => {
    render(
      <RouteWarmupSkeleton
        title="Network"
        detail="Opening from this device…"
        surface="network"
        compactChrome
      />,
    );

    expect(screen.getByText("Network")).toBeTruthy();
    expect(screen.getByText("Opening from this device…")).toBeTruthy();
    expect(screen.queryByText("Obscur")).toBeNull();
  });

  it("uses an opaque surface so prior route chrome cannot bleed through", () => {
    const { container } = render(
      <RouteWarmupSkeleton title="Vault" surface="vault" compactChrome />,
    );
    const root = container.firstElementChild;
    expect(root?.className).toMatch(/bg-zinc-50|bg-background|dark:bg-zinc-950/);
    expect(root?.className).not.toMatch(/\/90|\/40/);
  });
});
