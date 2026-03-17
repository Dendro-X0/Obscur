import { beforeEach, describe, expect, it, vi } from "vitest";
import { windowRuntimeSupervisor, windowRuntimeSupervisorInternals } from "@/app/features/runtime/services/window-runtime-supervisor";
import { messagingTransportRuntime } from "./messaging-transport-runtime";
import { logAppEvent } from "@/app/shared/log-app-event";

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("messaging-transport-runtime", () => {
  beforeEach(() => {
    windowRuntimeSupervisorInternals.resetForTests();
    messagingTransportRuntime.resetForTests();
    vi.mocked(logAppEvent).mockClear();
  });

  it("tracks incoming owner and queue processor counts in runtime snapshot", () => {
    messagingTransportRuntime.registerIncomingOwner({
      controllerInstanceId: "controller-1",
      transportOwnerId: "runtime_owner",
    });
    messagingTransportRuntime.registerQueueProcessor({
      controllerInstanceId: "controller-1",
      transportOwnerId: "runtime_owner",
    });

    expect(messagingTransportRuntime.getSnapshot()).toMatchObject({
      activeIncomingOwnerCount: 1,
      activeQueueProcessorCount: 1,
    });
    expect(windowRuntimeSupervisor.getSnapshot().messagingTransportRuntime).toMatchObject({
      activeIncomingOwnerCount: 1,
      activeQueueProcessorCount: 1,
    });

    messagingTransportRuntime.unregisterIncomingOwner("controller-1");
    messagingTransportRuntime.unregisterQueueProcessor("controller-1");

    expect(messagingTransportRuntime.getSnapshot()).toMatchObject({
      activeIncomingOwnerCount: 0,
      activeQueueProcessorCount: 0,
    });
  });

  it("emits warning invariant events when active incoming owners are not exactly one", () => {
    messagingTransportRuntime.registerIncomingOwner({
      controllerInstanceId: "controller-1",
      transportOwnerId: "runtime_owner",
    });
    messagingTransportRuntime.registerIncomingOwner({
      controllerInstanceId: "controller-2",
      transportOwnerId: "another_owner",
    });

    const invariantEvents = vi.mocked(logAppEvent).mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.name === "messaging.transport.runtime_invariant");

    expect(invariantEvents).toHaveLength(2);
    expect(invariantEvents[0]?.level).toBe("info");
    expect(invariantEvents[1]?.level).toBe("warn");
    expect(invariantEvents[1]?.context).toMatchObject({
      activeIncomingOwnerCount: 2,
    });
  });

  it("keeps invariant level info when runtime has no active owners or processors", () => {
    messagingTransportRuntime.resetForTests();

    const invariantEvents = vi.mocked(logAppEvent).mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.name === "messaging.transport.runtime_invariant");

    expect(invariantEvents.at(-1)?.level).toBe("info");
    expect(invariantEvents.at(-1)?.context).toMatchObject({
      activeIncomingOwnerCount: 0,
      activeQueueProcessorCount: 0,
    });
  });

  it("keeps single-owner invariant stable during rapid register/unregister churn", () => {
    for (let iteration = 0; iteration < 25; iteration += 1) {
      messagingTransportRuntime.registerIncomingOwner({
        controllerInstanceId: "controller-1",
        transportOwnerId: "runtime_owner",
      });
      messagingTransportRuntime.registerQueueProcessor({
        controllerInstanceId: "controller-1",
        transportOwnerId: "runtime_owner",
      });
      messagingTransportRuntime.unregisterQueueProcessor("controller-1");
      messagingTransportRuntime.unregisterIncomingOwner("controller-1");
    }

    messagingTransportRuntime.registerIncomingOwner({
      controllerInstanceId: "controller-1",
      transportOwnerId: "runtime_owner",
    });
    messagingTransportRuntime.registerQueueProcessor({
      controllerInstanceId: "controller-1",
      transportOwnerId: "runtime_owner",
    });

    expect(messagingTransportRuntime.getSnapshot()).toMatchObject({
      activeIncomingOwnerCount: 1,
      activeQueueProcessorCount: 1,
    });

    const warnInvariantEvents = vi.mocked(logAppEvent).mock.calls
      .map((call) => call[0])
      .filter((entry) => entry.name === "messaging.transport.runtime_invariant" && entry.level === "warn");

    expect(warnInvariantEvents).toHaveLength(0);
  });
});
