import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shouldUseLegacyStandaloneRelayPublish: vi.fn(() => false),
  shouldRouteHostTransportPublish: vi.fn(() => false),
  shouldBlockStandaloneLegacyPublishFallback: vi.fn(() => false),
  shouldRouteSubtractedStandalonePublishPort: vi.fn(() => false),
  publishHostTransportShimToRelayUrls: vi.fn(async (urls: ReadonlyArray<string>) => ({
    success: true,
    successCount: urls.length,
    totalRelays: urls.length,
    quorumRequired: 1,
    metQuorum: true,
    results: urls.map((relayUrl) => ({ relayUrl, success: true })),
    failures: [],
  })),
  publishTransportKernelToRelayUrls: vi.fn(async (urls: ReadonlyArray<string>) => ({
    success: false,
    successCount: 0,
    totalRelays: urls.length,
    quorumRequired: 1,
    metQuorum: false,
    results: [],
    failures: [],
    overallError: "standalone path",
  })),
  setPendingOutbound: vi.fn(),
  clearPendingOutbound: vi.fn(),
}));

vi.mock("@/app/features/transport-kernel/transport-kernel-publish-port", () => ({
  shouldUseLegacyStandaloneRelayPublish: mocks.shouldUseLegacyStandaloneRelayPublish,
  shouldRouteHostTransportPublish: mocks.shouldRouteHostTransportPublish,
  shouldBlockStandaloneLegacyPublishFallback: mocks.shouldBlockStandaloneLegacyPublishFallback,
  shouldRouteSubtractedStandalonePublishPort: mocks.shouldRouteSubtractedStandalonePublishPort,
}));

vi.mock("@/app/features/relays/hooks/enhanced-relay-pool-legacy", () => ({
  publishToRelayStandalone: vi.fn(),
  publishToUrlsStandalone: vi.fn(),
}));

vi.mock("@/app/features/transport-kernel/transport-kernel-host-publish-shim", () => ({
  publishHostTransportShimToRelay: vi.fn(),
  publishHostTransportShimToRelayUrls: mocks.publishHostTransportShimToRelayUrls,
}));

vi.mock("@/app/features/transport-kernel/transport-kernel-standalone-publish-legacy", () => ({
  publishTransportKernelToRelay: vi.fn(),
  publishTransportKernelToRelayUrls: mocks.publishTransportKernelToRelayUrls,
}));

vi.mock("@/app/features/transport-kernel/transport-kernel-standalone-publish-blocked", () => ({
  publishStandaloneLegacyBlockedToRelay: vi.fn(),
  publishStandaloneLegacyBlockedToRelayUrls: vi.fn(),
}));

vi.mock("@/app/features/relays/hooks/relay-standalone-publish-port-subtracted", () => ({
  publishToRelayStandaloneSubtracted: vi.fn(),
  publishToUrlsStandaloneSubtracted: vi.fn(),
}));

vi.mock("@/app/features/relays/services/relay-transport-journal", () => ({
  relayTransportJournal: {
    setPendingOutbound: mocks.setPendingOutbound,
    clearPendingOutbound: mocks.clearPendingOutbound,
  },
}));

import { publishToUrlsStandalone } from "@/app/features/relays/hooks/relay-standalone-publish-port";

describe("transport-engine w50 — authority-gated port routing harness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldUseLegacyStandaloneRelayPublish.mockReturnValue(false);
    mocks.shouldRouteHostTransportPublish.mockReturnValue(false);
    mocks.shouldBlockStandaloneLegacyPublishFallback.mockReturnValue(false);
    mocks.shouldRouteSubtractedStandalonePublishPort.mockReturnValue(false);
  });

  it("routes through host path when authority gate is on", async () => {
    mocks.shouldRouteHostTransportPublish.mockReturnValue(true);

    const result = await publishToUrlsStandalone(["wss://relay.one"], "payload");

    expect(mocks.publishHostTransportShimToRelayUrls).toHaveBeenCalledWith(
      ["wss://relay.one"],
      "payload",
    );
    expect(mocks.publishTransportKernelToRelayUrls).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("routes through standalone owner when authority and shim gates are off", async () => {
    const result = await publishToUrlsStandalone(["wss://relay.one"], "payload");

    expect(mocks.publishTransportKernelToRelayUrls).toHaveBeenCalledWith(
      ["wss://relay.one"],
      "payload",
    );
    expect(mocks.publishHostTransportShimToRelayUrls).not.toHaveBeenCalled();
    expect(result.overallError).toBe("standalone path");
  });
});
