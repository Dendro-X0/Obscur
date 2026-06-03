import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageTransitionLoadingShell } from "./page-transition-loading-shell";

vi.mock("@/app/features/runtime/experiment-shell-policy", () => ({
  shouldRunNavigationInstrumentation: () => true,
}));

describe("PageTransitionLoadingShell (X2)", () => {
  it("shows surface label when visible", () => {
    render(<PageTransitionLoadingShell visible pathname="/settings" />);
    expect(screen.getByText("Opening Settings")).toBeTruthy();
    expect(screen.getByText("Preparing layout...")).toBeTruthy();
  });

  it("hides content semantically when not visible", () => {
    render(<PageTransitionLoadingShell visible={false} pathname="/" />);
    expect(screen.getByText("Opening Messages").closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true");
  });
});
