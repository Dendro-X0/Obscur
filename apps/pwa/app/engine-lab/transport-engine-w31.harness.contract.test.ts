import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("transport-engine w31 — mocked invalid_payload host invoke path", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    resetTransportEngineHostForTests();
  });

  it("maps Rust invalid_payload to transport_publish_invoke_failed", async () => {
    mockInvoke.mockResolvedValue({
      ok: false,
      errorCode: "invalid_payload",
      errorMessage: "publishRelayEvent requires non-empty relayUrls",
    });

    const result = await publishRelayEventViaTransportEngineHost({
      profileId: "default",
      payload: {
        relayUrls: [],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invalid_payload invoke failure.");
    }
    expect(result.errorCode).toBe("transport_publish_invoke_failed");
    expect(result.errorMessage).toContain("relayUrls");
  });
});
