import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsTabPanel } from "./settings-tab-panel-loader";

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<any> }>) => {
    const loaderString = loader.toString();
    if (loaderString.includes("settings-tab-panel-model-provider")) {
      const Provider = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="model-provider">{children}</div>
      );
      return Provider;
    }
    return () => <div data-testid="lazy-tab-panel" />;
  },
}));

describe("SettingsTabPanel", () => {
  it("wraps the active tab panel in the lazy model provider", () => {
    render(<SettingsTabPanel activeTab="profile" />);
    expect(screen.getByTestId("model-provider")).toBeInTheDocument();
    expect(screen.getByTestId("lazy-tab-panel")).toBeInTheDocument();
  });
});
