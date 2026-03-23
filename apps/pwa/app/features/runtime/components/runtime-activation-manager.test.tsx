import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeActivationManager } from "./runtime-activation-manager";

const runtimeActivationMocks = vi.hoisted(() => ({
  runtime: {
    snapshot: {
      phase: "activating_runtime",
      degradedReason: "none",
      lastError: undefined as string | undefined,
      session: {
        profileId: "default",
        unlockedPublicKeyHex: "f".repeat(64),
      },
      relayRuntime: {
        phase: "healthy",
        recovery: { readiness: "healthy" },
        recoveryReasonCode: undefined as string | undefined,
        writableRelayCount: 1,
        subscribableRelayCount: 1,
        enabledRelayUrls: ["wss://relay.one"],
        lastFailureReason: undefined as string | undefined,
      },
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
    publicKeyHex: "f".repeat(64),
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
    driftStatus: "clean",
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
    phase: "shadow",
    rollbackEnabled: true,
    updatedAtUnixMs: 1_000,
  },
  setMigrationPolicy: vi.fn((patch: { phase?: string }, _scope?: { profileId?: string; accountPublicKeyHex?: string }) => ({
    phase: patch.phase ?? runtimeActivationMocks.migrationPolicy.phase,
    rollbackEnabled: runtimeActivationMocks.migrationPolicy.rollbackEnabled,
    updatedAtUnixMs: 2_000,
  })),
  logAppEvent: vi.fn(),
}));

vi.mock("@/app/features/runtime/services/window-runtime-supervisor", () => ({
  useWindowRuntime: () => runtimeActivationMocks.runtime,
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: runtimeActivationMocks.identityState,
  }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({
    relayPool: runtimeActivationMocks.relayPool,
    enabledRelayUrls: ["wss://relay.one"],
    relayList: {
      replaceRelays: runtimeActivationMocks.relayListReplaceRelays,
    },
  }),
}));

vi.mock("@/app/features/account-sync/hooks/use-account-sync", () => ({
  useAccountSync: () => ({
    snapshot: runtimeActivationMocks.accountSyncSnapshot,
  }),
}));

vi.mock("@/app/features/account-sync/hooks/use-account-projection-runtime", () => ({
  useAccountProjectionRuntime: () => ({
    snapshot: runtimeActivationMocks.projectionSnapshot,
  }),
}));

vi.mock("@/app/features/account-sync/services/account-sync-migration-policy", () => ({
  getAccountSyncMigrationPolicy: () => runtimeActivationMocks.migrationPolicy,
  setAccountSyncMigrationPolicy: runtimeActivationMocks.setMigrationPolicy,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: runtimeActivationMocks.logAppEvent,
}));

describe("RuntimeActivationManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeActivationMocks.runtime.snapshot.phase = "activating_runtime";
    runtimeActivationMocks.runtime.snapshot.degradedReason = "none";
    runtimeActivationMocks.runtime.snapshot.lastError = undefined;
    runtimeActivationMocks.runtime.snapshot.session.profileId = "default";
    runtimeActivationMocks.runtime.snapshot.session.unlockedPublicKeyHex = "f".repeat(64);
    runtimeActivationMocks.runtime.snapshot.relayRuntime.phase = "healthy";
    runtimeActivationMocks.runtime.snapshot.relayRuntime.recovery.readiness = "healthy";
    runtimeActivationMocks.runtime.snapshot.relayRuntime.recoveryReasonCode = undefined;
    runtimeActivationMocks.runtime.snapshot.relayRuntime.writableRelayCount = 1;
    runtimeActivationMocks.runtime.snapshot.relayRuntime.subscribableRelayCount = 1;
    runtimeActivationMocks.runtime.snapshot.relayRuntime.enabledRelayUrls = ["wss://relay.one"];
    runtimeActivationMocks.runtime.snapshot.relayRuntime.lastFailureReason = undefined;
    runtimeActivationMocks.runtime.snapshot.messagingTransportRuntime = {
      activeIncomingOwnerCount: 0,
      activeQueueProcessorCount: 0,
      updatedAtUnixMs: 1_000,
    };
    runtimeActivationMocks.identityState.publicKeyHex = "f".repeat(64);
    runtimeActivationMocks.identityState.privateKeyHex = "e".repeat(64);
    runtimeActivationMocks.relayPool.connections = [{ url: "wss://relay.one", status: "open" }];
    runtimeActivationMocks.accountSyncSnapshot.phase = "ready";
    runtimeActivationMocks.accountSyncSnapshot.publicKeyHex = "f".repeat(64);
    runtimeActivationMocks.accountSyncSnapshot.status = "public_restored";
    runtimeActivationMocks.accountSyncSnapshot.message = "Ready";
    runtimeActivationMocks.accountSyncSnapshot.lastRelayFailureReason = undefined;
    runtimeActivationMocks.projectionSnapshot.phase = "ready";
    runtimeActivationMocks.projectionSnapshot.status = "ready";
    runtimeActivationMocks.projectionSnapshot.accountProjectionReady = true;
    runtimeActivationMocks.projectionSnapshot.driftStatus = "clean";
    runtimeActivationMocks.projectionSnapshot.driftReport = undefined;
    runtimeActivationMocks.migrationPolicy.phase = "shadow";
    runtimeActivationMocks.migrationPolicy.rollbackEnabled = true;
  });

  it("marks runtime ready when account sync and projection gates are ready", () => {
    render(<RuntimeActivationManager />);

    expect(runtimeActivationMocks.runtime.markRuntimeReady).toHaveBeenCalledTimes(1);
    expect(runtimeActivationMocks.runtime.markRuntimeReady).toHaveBeenCalledWith(expect.objectContaining({
      accountSyncPhase: "ready",
      projectionPhase: "ready",
      projectionStatus: "ready",
      driftStatus: "clean",
    }));
  });

  it("promotes degraded runtime back to ready when activation gates converge", () => {
    runtimeActivationMocks.runtime.snapshot.phase = "degraded";
    runtimeActivationMocks.runtime.snapshot.degradedReason = "activation_timeout";
    runtimeActivationMocks.accountSyncSnapshot.phase = "ready";
    runtimeActivationMocks.accountSyncSnapshot.status = "public_restored";
    runtimeActivationMocks.projectionSnapshot.phase = "ready";
    runtimeActivationMocks.projectionSnapshot.status = "ready";
    runtimeActivationMocks.projectionSnapshot.accountProjectionReady = true;

    render(<RuntimeActivationManager />);

    expect(runtimeActivationMocks.runtime.markRuntimeReady).toHaveBeenCalledTimes(1);
    expect(runtimeActivationMocks.runtime.markRuntimeReady).toHaveBeenCalledWith(expect.objectContaining({
      accountSyncPhase: "ready",
      accountProjectionPhase: "ready",
      accountProjectionStatus: "ready",
    }));
  });

  it("degrades runtime when cutover rollback is triggered by critical drift", () => {
    runtimeActivationMocks.migrationPolicy.phase = "read_cutover";
    runtimeActivationMocks.migrationPolicy.rollbackEnabled = true;
    runtimeActivationMocks.projectionSnapshot.driftStatus = "drifted";
    runtimeActivationMocks.projectionSnapshot.driftReport = {
      criticalDriftCount: 2,
      nonCriticalDriftCount: 0,
      domains: ["contacts"],
      checkedAtUnixMs: 1_000,
    };

    render(<RuntimeActivationManager />);

    expect(runtimeActivationMocks.runtime.markRuntimeDegraded).toHaveBeenCalledTimes(1);
    expect(runtimeActivationMocks.runtime.markRuntimeDegraded).toHaveBeenCalledWith(
      "account_sync_degraded",
      expect.objectContaining({
        migrationPhase: "read_cutover",
        message: expect.stringContaining("Critical projection drift detected"),
      })
    );
  });

  it("promotes drift_gate to read_cutover when projection drift is clean", () => {
    runtimeActivationMocks.migrationPolicy.phase = "drift_gate";

    render(<RuntimeActivationManager />);

    expect(runtimeActivationMocks.setMigrationPolicy).toHaveBeenCalledWith(
      { phase: "read_cutover" },
      {
        profileId: "default",
        accountPublicKeyHex: "f".repeat(64),
      },
    );
  });

  it("promotes shadow to drift_gate once projection readiness is evidence-backed", () => {
    runtimeActivationMocks.migrationPolicy.phase = "shadow";

    render(<RuntimeActivationManager />);

    expect(runtimeActivationMocks.setMigrationPolicy).toHaveBeenCalledWith(
      { phase: "drift_gate" },
      {
        profileId: "default",
        accountPublicKeyHex: "f".repeat(64),
      },
    );
  });

  it("emits warn transport-owner invariant when projection is ready but owner counts are not 1/1", () => {
    runtimeActivationMocks.runtime.snapshot.phase = "ready";
    runtimeActivationMocks.runtime.snapshot.messagingTransportRuntime = {
      activeIncomingOwnerCount: 0,
      activeQueueProcessorCount: 0,
      updatedAtUnixMs: 2_000,
    };

    render(<RuntimeActivationManager />);

    expect(runtimeActivationMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "runtime.activation.transport_owner_invariant",
      level: "warn",
      context: expect.objectContaining({
        runtimePhase: "ready",
        activeIncomingOwnerCount: 0,
        activeQueueProcessorCount: 0,
      }),
    }));
  });

  it("emits info transport-owner invariant when owner counts converge to 1/1", () => {
    runtimeActivationMocks.runtime.snapshot.phase = "ready";
    runtimeActivationMocks.runtime.snapshot.messagingTransportRuntime = {
      activeIncomingOwnerCount: 1,
      activeQueueProcessorCount: 1,
      updatedAtUnixMs: 2_000,
    };

    render(<RuntimeActivationManager />);

    expect(runtimeActivationMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "runtime.activation.transport_owner_invariant",
      level: "info",
      context: expect.objectContaining({
        runtimePhase: "ready",
        activeIncomingOwnerCount: 1,
        activeQueueProcessorCount: 1,
      }),
    }));
  });

  it("emits transport invariant only after projection-ready and dedupes across relay churn", () => {
    runtimeActivationMocks.runtime.snapshot.phase = "ready";
    runtimeActivationMocks.runtime.snapshot.messagingTransportRuntime = {
      activeIncomingOwnerCount: 0,
      activeQueueProcessorCount: 0,
      updatedAtUnixMs: 2_000,
    };
    runtimeActivationMocks.projectionSnapshot.phase = "bootstrapping";
    runtimeActivationMocks.projectionSnapshot.status = "pending";
    runtimeActivationMocks.projectionSnapshot.accountProjectionReady = false;

    const view = render(<RuntimeActivationManager />);

    let invariantEvents = runtimeActivationMocks.logAppEvent.mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.name === "runtime.activation.transport_owner_invariant");
    expect(invariantEvents).toHaveLength(0);

    runtimeActivationMocks.projectionSnapshot.phase = "ready";
    runtimeActivationMocks.projectionSnapshot.status = "ready";
    runtimeActivationMocks.projectionSnapshot.accountProjectionReady = true;
    view.rerender(<RuntimeActivationManager />);

    invariantEvents = runtimeActivationMocks.logAppEvent.mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.name === "runtime.activation.transport_owner_invariant");
    expect(invariantEvents).toHaveLength(1);
    expect(invariantEvents[0]).toMatchObject({
      level: "warn",
      context: expect.objectContaining({
        activeIncomingOwnerCount: 0,
        activeQueueProcessorCount: 0,
      }),
    });

    runtimeActivationMocks.relayPool.connections = [
      { url: "wss://relay.one", status: "open" },
      { url: "wss://relay.two", status: "closed" },
    ];
    view.rerender(<RuntimeActivationManager />);

    invariantEvents = runtimeActivationMocks.logAppEvent.mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.name === "runtime.activation.transport_owner_invariant");
    expect(invariantEvents).toHaveLength(1);

    runtimeActivationMocks.runtime.snapshot.messagingTransportRuntime = {
      activeIncomingOwnerCount: 1,
      activeQueueProcessorCount: 1,
      updatedAtUnixMs: 3_000,
    };
    view.rerender(<RuntimeActivationManager />);

    invariantEvents = runtimeActivationMocks.logAppEvent.mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.name === "runtime.activation.transport_owner_invariant");
    expect(invariantEvents).toHaveLength(2);
    expect(invariantEvents[1]).toMatchObject({
      level: "info",
      context: expect.objectContaining({
        activeIncomingOwnerCount: 1,
        activeQueueProcessorCount: 1,
      }),
    });

    runtimeActivationMocks.relayPool.connections = [
      { url: "wss://relay.one", status: "open" },
      { url: "wss://relay.two", status: "open" },
      { url: "wss://relay.three", status: "open" },
    ];
    view.rerender(<RuntimeActivationManager />);

    invariantEvents = runtimeActivationMocks.logAppEvent.mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.name === "runtime.activation.transport_owner_invariant");
    expect(invariantEvents).toHaveLength(2);
  });

  it("fails open to degraded mode when activation exceeds timeout", () => {
    vi.useFakeTimers();
    runtimeActivationMocks.accountSyncSnapshot.phase = "restoring_account_data";
    runtimeActivationMocks.accountSyncSnapshot.status = "public_restored";
    runtimeActivationMocks.projectionSnapshot.phase = "bootstrapping";
    runtimeActivationMocks.projectionSnapshot.status = "pending";
    runtimeActivationMocks.projectionSnapshot.accountProjectionReady = false;

    render(<RuntimeActivationManager />);

    act(() => {
      vi.advanceTimersByTime(12_100);
    });

    expect(runtimeActivationMocks.runtime.markRuntimeDegraded).toHaveBeenCalledWith(
      "activation_timeout",
      expect.objectContaining({
        message: expect.stringContaining("timed out"),
      }),
    );

    vi.useRealTimers();
  });

  it("degrades activation when relay runtime gate is degraded even after projection/account-sync convergence", () => {
    runtimeActivationMocks.runtime.snapshot.phase = "activating_runtime";
    runtimeActivationMocks.runtime.snapshot.relayRuntime.phase = "degraded";
    runtimeActivationMocks.runtime.snapshot.relayRuntime.recovery.readiness = "degraded";
    runtimeActivationMocks.runtime.snapshot.relayRuntime.recoveryReasonCode = "no_writable_relays";
    runtimeActivationMocks.runtime.snapshot.relayRuntime.writableRelayCount = 0;
    runtimeActivationMocks.runtime.snapshot.relayRuntime.subscribableRelayCount = 0;
    runtimeActivationMocks.runtime.snapshot.relayRuntime.enabledRelayUrls = ["wss://relay.one"];
    runtimeActivationMocks.runtime.snapshot.relayRuntime.lastFailureReason = "No writable relay connection";
    runtimeActivationMocks.accountSyncSnapshot.phase = "ready";
    runtimeActivationMocks.accountSyncSnapshot.status = "public_restored";
    runtimeActivationMocks.projectionSnapshot.phase = "ready";
    runtimeActivationMocks.projectionSnapshot.status = "ready";
    runtimeActivationMocks.projectionSnapshot.accountProjectionReady = true;

    render(<RuntimeActivationManager />);

    expect(runtimeActivationMocks.runtime.markRuntimeReady).not.toHaveBeenCalled();
    expect(runtimeActivationMocks.runtime.markRuntimeDegraded).toHaveBeenCalledWith(
      "relay_runtime_degraded",
      expect.objectContaining({
        degradedReason: "relay_runtime_degraded",
        message: "No writable relay connection",
      }),
    );
  });

  it("emits reason-coded profile-scope mismatch diagnostics when projection profile diverges from bound session", () => {
    runtimeActivationMocks.runtime.snapshot.phase = "activating_runtime";
    runtimeActivationMocks.runtime.snapshot.session.profileId = "profile-a";
    runtimeActivationMocks.projectionSnapshot.profileId = "profile-b";
    runtimeActivationMocks.projectionSnapshot.accountPublicKeyHex = "f".repeat(64);
    runtimeActivationMocks.accountSyncSnapshot.publicKeyHex = "f".repeat(64);

    render(<RuntimeActivationManager />);

    expect(runtimeActivationMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "runtime.activation.profile_scope_mismatch",
      level: "warn",
      context: expect.objectContaining({
        reasonCode: "projection_profile_mismatch_bound_profile",
        boundProfileId: "profile-a",
        projectionProfileId: "profile-b",
        runtimePhase: "activating_runtime",
      }),
    }));
  });

  it("dedupes profile-scope mismatch diagnostics for unchanged mismatch signatures", () => {
    runtimeActivationMocks.runtime.snapshot.phase = "ready";
    runtimeActivationMocks.runtime.snapshot.session.profileId = "default";
    runtimeActivationMocks.runtime.snapshot.session.unlockedPublicKeyHex = "f".repeat(64);
    runtimeActivationMocks.identityState.publicKeyHex = "f".repeat(64);
    runtimeActivationMocks.projectionSnapshot.profileId = "default";
    runtimeActivationMocks.projectionSnapshot.accountPublicKeyHex = "a".repeat(64);

    const view = render(<RuntimeActivationManager />);

    let mismatchEvents = runtimeActivationMocks.logAppEvent.mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.name === "runtime.activation.profile_scope_mismatch");
    expect(mismatchEvents).toHaveLength(1);
    expect(mismatchEvents[0]).toMatchObject({
      context: expect.objectContaining({
        reasonCode: "projection_account_mismatch_identity",
      }),
    });

    view.rerender(<RuntimeActivationManager />);
    mismatchEvents = runtimeActivationMocks.logAppEvent.mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.name === "runtime.activation.profile_scope_mismatch");
    expect(mismatchEvents).toHaveLength(1);
  });
});
