import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shouldUseLegacyStandaloneRelayPublish: vi.fn(() => false),
  shouldRouteHostTransportPublish: vi.fn(() => true),
  shouldBlockStandaloneLegacyPublishFallback: vi.fn(() => false),
  shouldRouteSubtractedStandalonePublishPort: vi.fn(() => false),
  publishHostTransportShimToRelayUrls: vi.fn(async (urls: ReadonlyArray<string>) => ({
    success: false,
    successCount: 0,
    totalRelays: urls.length,
    quorumRequired: 1,
    metQuorum: false,
    results: urls.map((relayUrl) => ({
      relayUrl,
      success: false,
      error: "transport_publish_dry_run: no network I/O",
    })),
    failures: urls.map((relayUrl) => ({
      relayUrl,
      success: false,
      error: "transport_publish_dry_run: no network I/O",
    })),
    overallError: `Quorum not met (0/${urls.length}).`,
  })),
  publishTransportKernelToRelayUrls: vi.fn(),
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

describe("transport-engine w39 — host shim dry-run integration harness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldUseLegacyStandaloneRelayPublish.mockReturnValue(false);
    mocks.shouldRouteHostTransportPublish.mockReturnValue(true);
  });

  it("routes through host shim and surfaces dry-run quorum failure shape", async () => {
    const result = await publishToUrlsStandalone(["wss://relay.one", "wss://relay.two"], "payload");

    expect(mocks.publishHostTransportShimToRelayUrls).toHaveBeenCalledWith(
      ["wss://relay.one", "wss://relay.two"],
      "payload",
    );
    expect(mocks.publishTransportKernelToRelayUrls).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.metQuorum).toBe(false);
    expect(result.overallError).toContain("Quorum not met");
  });
});
