import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTransportPublishRelayEventRequest } from "@obscur/engine-contracts";
import {
  publishRelayEventViaTransportEngineHost,
  resetTransportEngineHostForTests,
} from "@/app/features/transport-kernel/transport-engine-host-port";

const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock("@obscur/engine-host", () => ({
  isTauriEngineHostAvailable: () => true,
  createTauriEngineHost: () => ({
    invoke: mockInvoke,
    getSnapshot: async () => ({
      engine: "transport",
      scope: { profileId: "default" },
      phase: "offline" as const,
      revision: 0,
    }),
    subscribe: () => () => {},
  }),
}));

describe("transport-engine w28 — mocked transport_publish_invoke_failed host invoke path", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    resetTransportEngineHostForTests();
  });

  it("fails closed with transport_publish_invoke_failed for generic host invoke errors", async () => {
    mockInvoke.mockResolvedValue({
      ok: false,
      errorCode: "engine_dispatch_failed",
      errorMessage: "Transport engine dispatch rejected publishRelayEvent.",
    });

    const params = {
      profileId: "default",
      windowLabel: "main",
      payload: {
        relayUrls: ["wss://relay.one"],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
        correlationId: "corr-w28",
      },
    };

    const result = await publishRelayEventViaTransportEngineHost(params);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invoke-failed host publish path.");
    }
    expect(result.errorCode).toBe("transport_publish_invoke_failed");
    expect(result.errorMessage).toBe("Transport engine dispatch rejected publishRelayEvent.");
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(buildTransportPublishRelayEventRequest(params));
  });

  it("uses default invoke-failed message when host invoke omits errorMessage", async () => {
    mockInvoke.mockResolvedValue({
      ok: false,
      errorCode: "transport_internal_error",
    });

    const result = await publishRelayEventViaTransportEngineHost({
      profileId: "default",
      payload: {
        relayUrls: ["wss://relay.two"],
        payload: "[\"EVENT\",{\"id\":\"e2\"}]",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invoke-failed host publish path.");
    }
    expect(result.errorCode).toBe("transport_publish_invoke_failed");
    expect(result.errorMessage).toBe("Transport publish invoke failed.");
  });
});
