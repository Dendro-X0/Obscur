import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  UNAVAILABLE_RELAY_RUNTIME_STATUS,
  useSettingsRelayRuntimeStatus,
} from "./use-settings-relay-runtime-status";

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({
    relayPool: {
      connections: [{ url: "wss://relay.test", status: "open" }],
      healthMetrics: [],
    },
    relayList: {
      state: {
        relays: [{ url: "wss://relay.test", enabled: true }],
      },
    },
    relayRuntime: {
      writableRelayCount: 1,
      subscribableRelayCount: 1,
      phase: "healthy",
      recoveryStage: "none",
      lastInboundEventAtUnixMs: Date.now(),
      fallbackRelayUrls: [],
    },
  }),
}));

describe("useSettingsRelayRuntimeStatus", () => {
  it("returns a relay runtime status object for settings panels", () => {
    const { result } = renderHook(() => useSettingsRelayRuntimeStatus());
    expect(result.current.status).toBe("healthy");
    expect(result.current.openCount).toBe(1);
    expect(result.current.totalCount).toBe(1);
  });

  it("exports a stable unavailable fallback shape", () => {
    expect(UNAVAILABLE_RELAY_RUNTIME_STATUS.status).toBe("unavailable");
  });
});
