import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTransportPublishRelayEventRequest } from "@obscur/engine-contracts";
import {
  publishRelayEventViaTransportEngineHost,
  resetTransportEngineHostForTests,
} from "@/app/features/transport-kernel/transport-engine-host-port";

const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock("@obscur/engine-host/tauri", () => ({
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

describe("transport-engine w27 — mocked transport_publish_not_wired host invoke path", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    resetTransportEngineHostForTests();
  });

  it("fails closed with transport_publish_not_wired when host invoke returns not wired", async () => {
    mockInvoke.mockResolvedValue({
      ok: false,
      errorCode: "transport_publish_not_wired",
      errorMessage: "Transport publish is not wired.",
    });

    const params = {
      profileId: "default",
      windowLabel: "main",
      payload: {
        relayUrls: ["wss://relay.one"],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
        correlationId: "corr-w27",
      },
    };

    const result = await publishRelayEventViaTransportEngineHost(params);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected not-wired host publish path.");
    }
    expect(result.errorCode).toBe("transport_publish_not_wired");
    expect(result.errorMessage).toContain("not wired");
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(buildTransportPublishRelayEventRequest(params));
  });

  it("preserves explicit not-wired error message from host invoke", async () => {
    mockInvoke.mockResolvedValue({
      ok: false,
      errorCode: "transport_publish_not_wired",
      errorMessage: "publishRelayEvent remains stubbed until parity harness exit criteria are met",
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
      throw new Error("Expected not-wired host publish path.");
    }
    expect(result.errorCode).toBe("transport_publish_not_wired");
    expect(result.errorMessage).toBe(
      "publishRelayEvent remains stubbed until parity harness exit criteria are met",
    );
  });
});
