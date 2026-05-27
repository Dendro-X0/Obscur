import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsTabPanel } from "./settings-tab-panel-loader";

vi.mock("../settings-tab-panel-model", () => ({
  SettingsTabPanelModelProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="model-provider">{children}</div>,
}));

vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="lazy-tab-panel" />,
}));

describe("SettingsTabPanel", () => {
  it("wraps the active tab panel in the model provider", () => {
    render(<SettingsTabPanel activeTab="profile" />);
    expect(screen.getByTestId("model-provider")).toBeInTheDocument();
    expect(screen.getByTestId("lazy-tab-panel")).toBeInTheDocument();
  });
});
