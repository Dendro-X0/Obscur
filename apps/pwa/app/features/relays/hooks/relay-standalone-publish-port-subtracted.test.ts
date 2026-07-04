import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shouldUseLegacyStandaloneRelayPublish: vi.fn(() => false),
  shouldRouteHostTransportPublish: vi.fn(() => false),
  publishStandaloneLegacyBlockedToRelay: vi.fn(async (url: string) => ({
    success: false,
    relayUrl: url,
    error: "blocked",
  })),
  publishStandaloneLegacyBlockedToRelayUrls: vi.fn(async (urls: ReadonlyArray<string>) => ({
    success: false,
    successCount: 0,
    totalRelays: urls.length,
    quorumRequired: 1,
    metQuorum: false,
    results: urls.map((relayUrl) => ({ success: false, relayUrl, error: "blocked" })),
    failures: urls.map((relayUrl) => ({ success: false, relayUrl, error: "blocked" })),
    overallError: "blocked",
  })),
  publishHostTransportShimToRelay: vi.fn(),
  publishHostTransportShimToRelayUrls: vi.fn(async (urls: ReadonlyArray<string>) => ({
    success: true,
    successCount: urls.length,
    totalRelays: urls.length,
    quorumRequired: 1,
    metQuorum: true,
    results: urls.map((relayUrl) => ({ success: true, relayUrl })),
    failures: [],
  })),
  setPendingOutbound: vi.fn(),
  clearPendingOutbound: vi.fn(),
}));

vi.mock("@/app/features/transport-kernel/transport-kernel-publish-port", () => ({
  shouldUseLegacyStandaloneRelayPublish: mocks.shouldUseLegacyStandaloneRelayPublish,
  shouldRouteHostTransportPublish: mocks.shouldRouteHostTransportPublish,
}));

vi.mock("./enhanced-relay-pool-legacy", () => ({
  publishToRelayStandalone: vi.fn(),
  publishToUrlsStandalone: vi.fn(),
}));

vi.mock("@/app/features/transport-kernel/transport-kernel-standalone-publish-blocked", () => ({
  publishStandaloneLegacyBlockedToRelay: mocks.publishStandaloneLegacyBlockedToRelay,
  publishStandaloneLegacyBlockedToRelayUrls: mocks.publishStandaloneLegacyBlockedToRelayUrls,
}));

vi.mock("@/app/features/transport-kernel/transport-kernel-host-publish-shim", () => ({
  publishHostTransportShimToRelay: mocks.publishHostTransportShimToRelay,
  publishHostTransportShimToRelayUrls: mocks.publishHostTransportShimToRelayUrls,
}));

vi.mock("@/app/features/relays/services/relay-transport-journal", () => ({
  relayTransportJournal: {
    setPendingOutbound: mocks.setPendingOutbound,
    clearPendingOutbound: mocks.clearPendingOutbound,
  },
}));

import {
  publishToRelayStandaloneSubtracted,
  publishToUrlsStandaloneSubtracted,
} from "./relay-standalone-publish-port-subtracted";

describe("relay-standalone-publish-port-subtracted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldUseLegacyStandaloneRelayPublish.mockReturnValue(false);
    mocks.shouldRouteHostTransportPublish.mockReturnValue(false);
  });

  it("fail-closes when host routing is off", async () => {
    await publishToRelayStandaloneSubtracted("wss://relay.example", "payload");
    expect(mocks.publishStandaloneLegacyBlockedToRelay).toHaveBeenCalledWith("wss://relay.example", "payload");
    expect(mocks.publishHostTransportShimToRelayUrls).not.toHaveBeenCalled();
  });

  it("routes through host shim when authority gate is on", async () => {
    mocks.shouldRouteHostTransportPublish.mockReturnValue(true);
    await publishToUrlsStandaloneSubtracted(["wss://relay.one", "wss://relay.two"], "payload");
    expect(mocks.publishHostTransportShimToRelayUrls).toHaveBeenCalledWith(
      ["wss://relay.one", "wss://relay.two"],
      "payload",
    );
    expect(mocks.publishStandaloneLegacyBlockedToRelayUrls).not.toHaveBeenCalled();
  });
});
