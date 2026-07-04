import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendRelayMessage: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/relays/hooks/relay-native-adapter", () => ({
  relayNativeAdapter: {
    sendRelayMessage: mocks.sendRelayMessage,
  },
}));

import {
  publishTransportKernelToRelay,
  publishTransportKernelToRelayUrls,
} from "./transport-kernel-standalone-publish";

describe("transport-kernel-standalone-publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendRelayMessage.mockResolvedValue(undefined);
  });

  it("publishes a single relay through the native adapter", async () => {
    const result = await publishTransportKernelToRelay(" wss://relay.example ", "payload");
    expect(mocks.sendRelayMessage).toHaveBeenCalledWith("wss://relay.example", "payload");
    expect(result).toEqual({ success: true, relayUrl: "wss://relay.example" });
  });

  it("returns a validation error for empty relay URLs", async () => {
    const result = await publishTransportKernelToRelay("   ", "payload");
    expect(mocks.sendRelayMessage).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toContain("Empty relay URL");
  });

  it("builds quorum evidence for multi-relay publish", async () => {
    mocks.sendRelayMessage
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("timeout"));

    const result = await publishTransportKernelToRelayUrls([
      "wss://relay-1.example",
      " wss://relay-2.example ",
      "wss://relay-1.example",
    ], "payload");

    expect(mocks.sendRelayMessage).toHaveBeenCalledTimes(2);
    expect(result.successCount).toBe(1);
    expect(result.totalRelays).toBe(2);
    expect(result.quorumRequired).toBe(1);
    expect(result.metQuorum).toBe(true);
    expect(result.success).toBe(true);
    expect(result.failures).toHaveLength(1);
  });
});

