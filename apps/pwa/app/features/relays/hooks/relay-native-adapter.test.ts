import { beforeEach, describe, expect, it, vi } from "vitest";

const adapterMocks = vi.hoisted(() => ({
  invokeNativeCommand: vi.fn(),
  listenToNativeEvent: vi.fn(),
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: adapterMocks.invokeNativeCommand,
}));

vi.mock("@/app/features/runtime/native-event-adapter", () => ({
  listenToNativeEvent: adapterMocks.listenToNativeEvent,
}));

import { relayNativeAdapter } from "./relay-native-adapter";

describe("relay-native-adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns disabled tor status when native command is unavailable", async () => {
    adapterMocks.invokeNativeCommand.mockResolvedValue({
      ok: false,
      reason: "unsupported",
      message: "unsupported",
    });

    await expect(relayNativeAdapter.getTorStatus()).resolves.toBe("disabled");
  });

  it("maps relay commands through invokeNativeCommand", async () => {
    adapterMocks.invokeNativeCommand.mockResolvedValue({
      ok: true,
      value: "Already connected",
    });

    await expect(relayNativeAdapter.connectRelay("wss://relay.example")).resolves.toBe("Already connected");
    expect(adapterMocks.invokeNativeCommand).toHaveBeenCalledWith(
      "connect_relay",
      { url: "wss://relay.example" },
      expect.objectContaining({ timeoutMs: expect.any(Number) }),
    );
  });

  it("maps relay events through native event adapter", async () => {
    const unlisten = vi.fn();
    const handler = vi.fn();
    adapterMocks.listenToNativeEvent.mockResolvedValue(unlisten);

    const result = await relayNativeAdapter.listenRelayStatus(handler);

    expect(adapterMocks.listenToNativeEvent).toHaveBeenCalledWith("relay-status", handler);
    expect(result).toBe(unlisten);
  });
});
