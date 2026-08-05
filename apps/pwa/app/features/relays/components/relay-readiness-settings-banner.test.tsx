import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RelayReadinessSettingsBanner } from "./relay-readiness-settings-banner";

const relayState = vi.hoisted(() => ({
  relayRecovery: {
    readiness: "offline" as const,
    writableRelayCount: 0,
    fallbackWritableRelayCount: 0,
    subscribableRelayCount: 0,
    writeBlockedRelayCount: 0,
    coolingDownRelayCount: 0,
    recoveryAttemptCount: 0,
    fallbackRelayUrls: [] as string[],
    recoveryReasonCode: undefined as string | undefined,
  },
  relayRuntime: {
    phase: "offline" as string,
  },
  triggerRelayRecovery: vi.fn(async () => undefined),
}));

vi.mock("../providers/relay-provider", () => ({
  useRelay: () => relayState,
}));

describe("RelayReadinessSettingsBanner", () => {
  beforeEach(() => {
    relayState.relayRecovery = {
      readiness: "offline",
      writableRelayCount: 0,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 0,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 0,
      recoveryAttemptCount: 0,
      fallbackRelayUrls: [],
      recoveryReasonCode: undefined,
    };
    relayState.relayRuntime = { phase: "offline" };
    relayState.triggerRelayRecovery.mockClear();
  });

  it("suppresses offline during startup_warmup", () => {
    relayState.relayRecovery.recoveryReasonCode = "startup_warmup";
    relayState.relayRuntime.phase = "booting";
    render(<RelayReadinessSettingsBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("suppresses offline when writable evidence exists", () => {
    relayState.relayRecovery.writableRelayCount = 1;
    render(<RelayReadinessSettingsBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows offline when not warming up", () => {
    render(<RelayReadinessSettingsBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("Relay transport is offline");
  });
});
