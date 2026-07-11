import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RelayReadinessInlineBanner } from "./relay-readiness-inline-banner";

const relayState = vi.hoisted(() => ({
  relayRecovery: {
    readiness: "healthy",
    writableRelayCount: 1,
    fallbackWritableRelayCount: 0,
    subscribableRelayCount: 1,
    writeBlockedRelayCount: 0,
    coolingDownRelayCount: 0,
    recoveryAttemptCount: 0,
    fallbackRelayUrls: [],
    recoveryReasonCode: undefined as string | undefined,
  },
  relayRuntime: {
    phase: "healthy",
  },
}));

vi.mock("../providers/relay-provider", () => ({
  useRelay: () => relayState,
}));

describe("RelayReadinessInlineBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    relayState.relayRecovery = {
      readiness: "healthy",
      writableRelayCount: 1,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 1,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 0,
      recoveryAttemptCount: 0,
      fallbackRelayUrls: [],
      recoveryReasonCode: undefined,
    };
    relayState.relayRuntime = { phase: "healthy" };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("suppresses brief offline blips", () => {
    relayState.relayRecovery = {
      ...relayState.relayRecovery,
      readiness: "offline",
      writableRelayCount: 0,
      subscribableRelayCount: 0,
    };
    relayState.relayRuntime = { phase: "offline" };

    render(<RelayReadinessInlineBanner />);

    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows sustained offline state after a grace period", () => {
    relayState.relayRecovery = {
      ...relayState.relayRecovery,
      readiness: "offline",
      writableRelayCount: 0,
      subscribableRelayCount: 0,
    };
    relayState.relayRuntime = { phase: "offline" };

    render(<RelayReadinessInlineBanner />);

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByRole("status")).toHaveTextContent("Relay transport is offline");
  });

  it("still suppresses startup warmup offline snapshots", () => {
    relayState.relayRecovery = {
      ...relayState.relayRecovery,
      readiness: "offline",
      writableRelayCount: 0,
      subscribableRelayCount: 0,
      recoveryReasonCode: "startup_warmup",
    };
    relayState.relayRuntime = { phase: "booting" };

    render(<RelayReadinessInlineBanner />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByRole("status")).toBeNull();
  });
});
