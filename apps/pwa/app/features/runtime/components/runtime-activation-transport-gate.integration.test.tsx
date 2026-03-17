import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeActivationManager } from "./runtime-activation-manager";

const gateHarness = vi.hoisted(() => ({
  runtime: {
    snapshot: {
      phase: "activating_runtime",
      messagingTransportRuntime: {
        activeIncomingOwnerCount: 0,
        activeQueueProcessorCount: 0,
        updatedAtUnixMs: 1_000,
      },
    },
    markRuntimeReady: vi.fn(),
    markRuntimeDegraded: vi.fn(),
  },
  identityState: {
    publicKeyHex: "f".repeat(64),
    privateKeyHex: "e".repeat(64),
  },
  relayPool: {
    connections: [{ url: "wss://relay.one", status: "open" }],
  },
  relayListReplaceRelays: vi.fn(),
  accountSyncSnapshot: {
    phase: "ready",
    status: "public_restored",
    message: "Ready",
    lastRelayFailureReason: undefined as string | undefined,
  },
  projectionSnapshot: {
    profileId: "default",
    accountPublicKeyHex: "f".repeat(64),
    projection: null,
    phase: "ready",
    status: "ready",
    accountProjectionReady: true,
    driftStatus: "clean" as "unknown" | "clean" | "drifted",
    driftReport: undefined as
      | {
          criticalDriftCount: number;
          nonCriticalDriftCount: number;
          domains: ReadonlyArray<"contacts" | "messages" | "sync">;
          checkedAtUnixMs: number;
        }
      | undefined,
    updatedAtUnixMs: 1_000,
  },
  migrationPolicy: {
    phase: "read_cutover",
    rollbackEnabled: true,
    updatedAtUnixMs: 1_000,
  },
  setMigrationPolicy: vi.fn((patch: { phase?: string }, _scope?: { profileId?: string; accountPublicKeyHex?: string }) => ({
    phase: patch.phase ?? gateHarness.migrationPolicy.phase,
    rollbackEnabled: gateHarness.migrationPolicy.rollbackEnabled,
    updatedAtUnixMs: 2_000,
  })),
  logAppEvent: vi.fn(),
}));

vi.mock("@/app/features/runtime/services/window-runtime-supervisor", () => ({
  useWindowRuntime: () => gateHarness.runtime,
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: gateHarness.identityState,
  }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({
    relayPool: gateHarness.relayPool,
    enabledRelayUrls: ["wss://relay.one"],
    relayList: {
      replaceRelays: gateHarness.relayListReplaceRelays,
    },
  }),
}));

vi.mock("@/app/features/account-sync/hooks/use-account-sync", () => ({
  useAccountSync: () => ({
    snapshot: gateHarness.accountSyncSnapshot,
  }),
}));

vi.mock("@/app/features/account-sync/hooks/use-account-projection-runtime", () => ({
  useAccountProjectionRuntime: () => ({
    snapshot: gateHarness.projectionSnapshot,
  }),
}));

vi.mock("@/app/features/account-sync/services/account-sync-migration-policy", () => ({
  getAccountSyncMigrationPolicy: () => gateHarness.migrationPolicy,
  setAccountSyncMigrationPolicy: gateHarness.setMigrationPolicy,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: gateHarness.logAppEvent,
}));

describe("runtime activation transport gate deterministic flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateHarness.runtime.snapshot.phase = "activating_runtime";
    gateHarness.runtime.snapshot.messagingTransportRuntime = {
      activeIncomingOwnerCount: 0,
      activeQueueProcessorCount: 0,
      updatedAtUnixMs: 1_000,
    };
    gateHarness.accountSyncSnapshot.phase = "ready";
    gateHarness.accountSyncSnapshot.status = "public_restored";
    gateHarness.projectionSnapshot.phase = "ready";
    gateHarness.projectionSnapshot.status = "ready";
    gateHarness.projectionSnapshot.accountProjectionReady = true;
    gateHarness.projectionSnapshot.driftStatus = "clean";
    gateHarness.projectionSnapshot.driftReport = undefined;
    gateHarness.migrationPolicy.phase = "read_cutover";
    gateHarness.migrationPolicy.rollbackEnabled = true;
  });

  it("degrades on cutover critical drift, recovers to ready, then converges owner invariant", () => {
    gateHarness.projectionSnapshot.driftStatus = "drifted";
    gateHarness.projectionSnapshot.driftReport = {
      criticalDriftCount: 2,
      nonCriticalDriftCount: 0,
      domains: ["contacts"],
      checkedAtUnixMs: 1_000,
    };

    const view = render(<RuntimeActivationManager />);
    expect(gateHarness.runtime.markRuntimeDegraded).toHaveBeenCalledTimes(1);
    expect(gateHarness.runtime.markRuntimeReady).toHaveBeenCalledTimes(0);

    gateHarness.projectionSnapshot.driftStatus = "clean";
    gateHarness.projectionSnapshot.driftReport = {
      criticalDriftCount: 0,
      nonCriticalDriftCount: 0,
      domains: [],
      checkedAtUnixMs: 2_000,
    };
    view.rerender(<RuntimeActivationManager />);
    expect(gateHarness.runtime.markRuntimeReady).toHaveBeenCalledTimes(1);

    gateHarness.runtime.snapshot.phase = "ready";
    gateHarness.runtime.snapshot.messagingTransportRuntime = {
      activeIncomingOwnerCount: 0,
      activeQueueProcessorCount: 0,
      updatedAtUnixMs: 2_000,
    };
    view.rerender(<RuntimeActivationManager />);

    gateHarness.runtime.snapshot.messagingTransportRuntime = {
      activeIncomingOwnerCount: 1,
      activeQueueProcessorCount: 1,
      updatedAtUnixMs: 3_000,
    };
    view.rerender(<RuntimeActivationManager />);

    const invariantEvents = gateHarness.logAppEvent.mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.name === "runtime.activation.transport_owner_invariant");
    expect(invariantEvents).toHaveLength(2);
    expect(invariantEvents[0]).toMatchObject({
      level: "warn",
      context: expect.objectContaining({
        activeIncomingOwnerCount: 0,
        activeQueueProcessorCount: 0,
      }),
    });
    expect(invariantEvents[1]).toMatchObject({
      level: "info",
      context: expect.objectContaining({
        activeIncomingOwnerCount: 1,
        activeQueueProcessorCount: 1,
      }),
    });
  });

  it("dedupes owner invariant logs across relay-only churn when owner counters are stable", () => {
    gateHarness.runtime.snapshot.phase = "ready";
    gateHarness.runtime.snapshot.messagingTransportRuntime = {
      activeIncomingOwnerCount: 1,
      activeQueueProcessorCount: 1,
      updatedAtUnixMs: 1_000,
    };

    const view = render(<RuntimeActivationManager />);

    gateHarness.relayPool.connections = [{ url: "wss://relay.one", status: "open" }];
    view.rerender(<RuntimeActivationManager />);
    gateHarness.relayPool.connections = [
      { url: "wss://relay.one", status: "open" },
      { url: "wss://relay.two", status: "closed" },
    ];
    view.rerender(<RuntimeActivationManager />);
    gateHarness.relayPool.connections = [
      { url: "wss://relay.one", status: "open" },
      { url: "wss://relay.two", status: "open" },
      { url: "wss://relay.three", status: "open" },
    ];
    view.rerender(<RuntimeActivationManager />);

    const invariantEvents = gateHarness.logAppEvent.mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.name === "runtime.activation.transport_owner_invariant");
    expect(invariantEvents).toHaveLength(1);
    expect(invariantEvents[0]).toMatchObject({
      level: "info",
      context: expect.objectContaining({
        activeIncomingOwnerCount: 1,
        activeQueueProcessorCount: 1,
      }),
    });
  });
});
