import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishHostTransportShimToRelayUrls } from "@/app/features/transport-kernel/transport-kernel-host-publish-shim";
import { publishTransportKernelToRelayUrls } from "@/app/features/transport-kernel/transport-kernel-standalone-publish";
import { resetTransportEngineHostForTests } from "@/app/features/transport-kernel/transport-engine-host-port";
import {
  assertNetworkPublishParity,
  buildHostNetworkPublishResultFromAttempts,
  type RelayAttemptFixture,
} from "./transport-engine-network-publish-parity";

const mockInvoke = vi.hoisted(() => vi.fn());
const mockSendRelayMessage = vi.hoisted(() => vi.fn());

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

vi.mock("@/app/features/relays/hooks/relay-native-adapter", () => ({
  relayNativeAdapter: {
    sendRelayMessage: mockSendRelayMessage,
  },
}));

const runNetworkParityCase = async (
  attempts: ReadonlyArray<RelayAttemptFixture>,
  payload = "[\"EVENT\",{\"id\":\"parity\"}]",
): Promise<void> => {
  mockSendRelayMessage.mockImplementation(async (relayUrl: string) => {
    const attempt = attempts.find((entry) => entry.relayUrl === relayUrl.trim());
    if (!attempt?.success) {
      throw new Error(attempt?.error ?? "Native relay publish failed");
    }
  });

  const relayUrls = attempts.map((attempt) => attempt.relayUrl);
  const hostNetworkResult = buildHostNetworkPublishResultFromAttempts(attempts);
  mockInvoke.mockResolvedValue({ ok: true, data: hostNetworkResult });

  const standalone = await publishTransportKernelToRelayUrls(relayUrls, payload);
  const host = await publishHostTransportShimToRelayUrls(relayUrls, payload);

  assertNetworkPublishParity(standalone, host);
};

describe("transport-engine w47 — network publish parity harness", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockSendRelayMessage.mockReset();
    resetTransportEngineHostForTests();
    vi.unstubAllEnvs();
  });

  it("aligns quorum_not_met fixtures between standalone owner and host shim", async () => {
    await runNetworkParityCase([
      { relayUrl: "wss://relay.one", success: false, error: "timeout" },
      { relayUrl: "wss://relay.two", success: false, error: "relay rejected" },
    ]);
  });

  it("aligns relay_degraded fixtures between standalone owner and host shim", async () => {
    await runNetworkParityCase([
      { relayUrl: "wss://relay.one", success: true },
      { relayUrl: "wss://relay.two", success: true },
      { relayUrl: "wss://relay.three", success: false, error: "timeout" },
    ]);
  });

  it("aligns full-success fixtures between standalone owner and host shim", async () => {
    await runNetworkParityCase([
      { relayUrl: "wss://relay.one", success: true },
    ]);
  });
});
