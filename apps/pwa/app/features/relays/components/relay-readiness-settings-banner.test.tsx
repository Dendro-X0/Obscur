import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
  setPrimaryRelay: vi.fn(),
  relayList: {
    state: {
      relays: [
        { url: "wss://nos.lol", enabled: true },
        { url: "ws://localhost:7000", enabled: false },
      ],
    },
    replaceRelays: vi.fn(),
  },
}));

const poolDiagnosisState = vi.hoisted(() => ({
  disabledCount: 1,
  invalidSchemeCount: 0,
  enabledRemoteDisconnectedCount: 1,
  enabledLoopbackDisconnectedCount: 0,
  openCount: 0,
  connectingCount: 0,
  loopbackDisabledCount: 1,
  hypothesisCopy: "Public path unhealthy; local relay not tried — enable ws://localhost:7000 for private-trust.",
  bannerSupplement: "1 disabled (incl. local) · 1 enabled remotes with no open socket",
}));

vi.mock("../providers/relay-provider", () => ({
  useRelay: () => relayState,
}));

vi.mock("../hooks/use-relay-pool-diagnosis", () => ({
  useRelayPoolDiagnosis: () => poolDiagnosisState,
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
    relayState.setPrimaryRelay.mockClear();
    relayState.relayList.replaceRelays.mockClear();
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

  it("applies Track L private-trust layout from the CTA", () => {
    render(<RelayReadinessSettingsBanner />);
    fireEvent.click(screen.getByTestId("track-l-private-trust-cta"));
    expect(relayState.relayList.replaceRelays).toHaveBeenCalled();
    expect(relayState.setPrimaryRelay).toHaveBeenCalledWith("ws://localhost:7000");
    expect(relayState.triggerRelayRecovery).toHaveBeenCalledWith("manual");
    expect(screen.getByTestId("track-l-private-trust-result")).toHaveTextContent(/Private-trust layout applied/i);
  });
});

