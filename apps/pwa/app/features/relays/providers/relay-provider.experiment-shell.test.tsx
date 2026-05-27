import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const policyMocks = vi.hoisted(() => ({
  isExperimentOfflineStubEnabled: vi.fn(() => true),
}));

vi.mock("@/app/features/runtime/experiment-shell-policy", () => ({
  isExperimentOfflineStubEnabled: policyMocks.isExperimentOfflineStubEnabled,
}));

vi.mock("./experiment-relay-shell", () => ({
  ExperimentRelayShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="experiment-relay-shell">{children}</div>
  ),
}));

import { RelayProvider } from "./relay-provider";

describe("RelayProvider experiment shell", () => {
  beforeEach(() => {
    policyMocks.isExperimentOfflineStubEnabled.mockReturnValue(true);
  });

  it("uses ExperimentRelayShell when offline stub policy is enabled", () => {
    render(
      <RelayProvider>
        <span>child</span>
      </RelayProvider>,
    );
    expect(screen.getByTestId("experiment-relay-shell")).toBeTruthy();
    expect(screen.getByText("child")).toBeTruthy();
  });
});
