import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ChatRouteMainShell } from "./chat-route-main-shell";

const pathnameRef = { current: "/" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

vi.mock("@/app/features/main-shell/main-shell", () => ({
  default: () => <div data-testid="main-shell" />,
}));

describe("ChatRouteMainShell", () => {
  it("keeps MainShell mounted but hidden off the chat route", () => {
    pathnameRef.current = "/";
    const { getByTestId, unmount } = render(<ChatRouteMainShell />);
    const shell = getByTestId("main-shell");
    expect(shell).toBeTruthy();
    expect(shell.parentElement?.hasAttribute("hidden")).toBe(false);
    unmount();

    pathnameRef.current = "/network";
    const network = render(<ChatRouteMainShell />);
    const offRouteShell = network.getByTestId("main-shell");
    expect(offRouteShell).toBeTruthy();
    expect(offRouteShell.parentElement?.hasAttribute("hidden")).toBe(true);
  });
});
