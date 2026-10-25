import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  LocalRouteTransitionShell,
  shouldShowLocalRouteTransitionShell,
} from "./local-route-transition-shell";
import type { GlobalNavLoadingRenderState } from "../global-navigation-loading/global-navigation-loading-state";

const baseState = (overrides: Partial<GlobalNavLoadingRenderState> = {}): GlobalNavLoadingRenderState => ({
  visible: true,
  progress: 24,
  completing: false,
  targetPathname: "/vault",
  ...overrides,
});

describe("shouldShowLocalRouteTransitionShell", () => {
  it("shows while navigating away from the current pathname", () => {
    expect(shouldShowLocalRouteTransitionShell(baseState(), "/")).toBe(true);
  });

  it("hides once the target pathname has committed", () => {
    expect(shouldShowLocalRouteTransitionShell(baseState(), "/vault")).toBe(false);
  });

  it("hides while completing or without a target", () => {
    expect(shouldShowLocalRouteTransitionShell(baseState({ completing: true }), "/")).toBe(false);
    expect(shouldShowLocalRouteTransitionShell(baseState({ targetPathname: null }), "/")).toBe(false);
    expect(shouldShowLocalRouteTransitionShell(baseState({ visible: false }), "/")).toBe(false);
  });
});

describe("LocalRouteTransitionShell", () => {
  it("renders an on-device vault skeleton for the pending target", () => {
    render(
      <LocalRouteTransitionShell navState={baseState()} currentPathname="/" />,
    );
    expect(screen.getByTestId("local-route-transition-shell")).toBeInTheDocument();
    expect(screen.getByText("Vault")).toBeInTheDocument();
    expect(screen.getByText("Opening from this device…")).toBeInTheDocument();
    // Under AppShell header — no second Obscur brand line.
    expect(screen.queryByText("Obscur")).not.toBeInTheDocument();
  });

  it("renders nothing after the route has settled", () => {
    const { container } = render(
      <LocalRouteTransitionShell navState={baseState()} currentPathname="/vault" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
