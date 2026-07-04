import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shouldUseLegacyStandaloneRelayPublish: vi.fn(() => true),
  shouldRouteHostTransportPublish: vi.fn(() => false),
  shouldBlockStandaloneLegacyPublishFallback: vi.fn(() => false),
  shouldRouteSubtractedStandalonePublishPort: vi.fn(() => false),
  publishLegacyToRelayStandalone: vi.fn(async (url: string) => ({ success: true, relayUrl: url })),
  publishLegacyToUrlsStandalone: vi.fn(async (urls: ReadonlyArray<string>) => ({
    success: true,
    successCount: urls.length,
    totalRelays: urls.length,
    results: urls.map((relayUrl) => ({ success: true, relayUrl })),
  })),
  publishTransportKernelToRelay: vi.fn(async (url: string) => ({ success: true, relayUrl: url })),
  publishTransportKernelToRelayUrls: vi.fn(async (urls: ReadonlyArray<string>) => ({
    success: true,
    successCount: urls.length,
    totalRelays: urls.length,
    quorumRequired: 1,
    metQuorum: true,
    results: urls.map((relayUrl) => ({ success: true, relayUrl })),
    failures: [],
  })),
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
  publishToRelayStandaloneSubtracted: vi.fn(async (url: string) => ({
    success: false,
    relayUrl: url,
    error: "subtracted",
  })),
  publishToUrlsStandaloneSubtracted: vi.fn(async (urls: ReadonlyArray<string>) => ({
    success: false,
    successCount: 0,
    totalRelays: urls.length,
    quorumRequired: 1,
    metQuorum: false,
    results: urls.map((relayUrl) => ({ success: false, relayUrl, error: "subtracted" })),
    failures: urls.map((relayUrl) => ({ success: false, relayUrl, error: "subtracted" })),
    overallError: "subtracted",
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

vi.mock("./enhanced-relay-pool-legacy", () => ({
  publishToRelayStandalone: mocks.publishLegacyToRelayStandalone,
  publishToUrlsStandalone: mocks.publishLegacyToUrlsStandalone,
}));

vi.mock("@/app/features/transport-kernel/transport-kernel-standalone-publish-legacy", () => ({
  publishTransportKernelToRelay: mocks.publishTransportKernelToRelay,
  publishTransportKernelToRelayUrls: mocks.publishTransportKernelToRelayUrls,
}));

vi.mock("@/app/features/transport-kernel/transport-kernel-standalone-publish-blocked", () => ({
  publishStandaloneLegacyBlockedToRelay: mocks.publishStandaloneLegacyBlockedToRelay,
  publishStandaloneLegacyBlockedToRelayUrls: mocks.publishStandaloneLegacyBlockedToRelayUrls,
}));

vi.mock("./relay-standalone-publish-port-subtracted", () => ({
  publishToRelayStandaloneSubtracted: mocks.publishToRelayStandaloneSubtracted,
  publishToUrlsStandaloneSubtracted: mocks.publishToUrlsStandaloneSubtracted,
}));

vi.mock("@/app/features/relays/services/relay-transport-journal", () => ({
  relayTransportJournal: {
    setPendingOutbound: mocks.setPendingOutbound,
    clearPendingOutbound: mocks.clearPendingOutbound,
  },
}));

import {
  publishToRelayStandalone,
  publishToUrlsStandalone,
} from "./relay-standalone-publish-port";

describe("relay-standalone-publish-port", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldUseLegacyStandaloneRelayPublish.mockReturnValue(true);
    mocks.shouldRouteHostTransportPublish.mockReturnValue(false);
    mocks.shouldBlockStandaloneLegacyPublishFallback.mockReturnValue(false);
    mocks.shouldRouteSubtractedStandalonePublishPort.mockReturnValue(false);
    mocks.publishLegacyToRelayStandalone.mockResolvedValue({ success: true, relayUrl: "wss://relay.example" });
    mocks.publishLegacyToUrlsStandalone.mockResolvedValue({
      success: true,
      successCount: 2,
      totalRelays: 2,
      results: [
        { success: true, relayUrl: "wss://relay-1.example" },
        { success: true, relayUrl: "wss://relay-2.example" },
      ],
    });
  });

  it("delegates directly on legacy publish path", async () => {
    await publishToRelayStandalone("wss://relay.example", "payload");
    expect(mocks.publishLegacyToRelayStandalone).toHaveBeenCalledWith("wss://relay.example", "payload");
    expect(mocks.setPendingOutbound).not.toHaveBeenCalled();
    expect(mocks.clearPendingOutbound).not.toHaveBeenCalled();
  });

  it("tracks journal around native single-relay publish", async () => {
    mocks.shouldUseLegacyStandaloneRelayPublish.mockReturnValue(false);
    await publishToRelayStandalone(" wss://relay.example ", "payload");
    expect(mocks.setPendingOutbound).toHaveBeenCalledWith("transport_kernel_standalone_publish", 1);
    expect(mocks.publishTransportKernelToRelay).toHaveBeenCalledWith("wss://relay.example", "payload");
    expect(mocks.publishLegacyToRelayStandalone).not.toHaveBeenCalled();
    expect(mocks.clearPendingOutbound).toHaveBeenCalledWith("transport_kernel_standalone_publish");
  });

  it("tracks normalized relay count around native multi-publish", async () => {
    mocks.shouldUseLegacyStandaloneRelayPublish.mockReturnValue(false);
    await publishToUrlsStandalone([
      "wss://relay-1.example",
      " wss://relay-2.example ",
      "wss://relay-1.example",
      "   ",
    ], "payload");
    expect(mocks.setPendingOutbound).toHaveBeenCalledWith("transport_kernel_standalone_publish", 2);
    expect(mocks.publishTransportKernelToRelayUrls).toHaveBeenCalledWith([
      "wss://relay-1.example",
      "wss://relay-2.example",
    ], "payload");
    expect(mocks.publishLegacyToUrlsStandalone).not.toHaveBeenCalled();
    expect(mocks.clearPendingOutbound).toHaveBeenCalledWith("transport_kernel_standalone_publish");
  });

  it("routes to subtracted port when deletion rehearsal env delegates native owner path", async () => {
    mocks.shouldUseLegacyStandaloneRelayPublish.mockReturnValue(false);
    mocks.shouldRouteSubtractedStandalonePublishPort.mockReturnValue(true);
    await publishToRelayStandalone("wss://relay.example", "payload");
    expect(mocks.publishToRelayStandaloneSubtracted).toHaveBeenCalledWith("wss://relay.example", "payload");
    expect(mocks.publishTransportKernelToRelay).not.toHaveBeenCalled();
    expect(mocks.publishStandaloneLegacyBlockedToRelay).not.toHaveBeenCalled();
    expect(mocks.setPendingOutbound).not.toHaveBeenCalled();
  });

  it("routes multi-publish to subtracted port when deletion rehearsal env is on", async () => {
    mocks.shouldUseLegacyStandaloneRelayPublish.mockReturnValue(false);
    mocks.shouldRouteSubtractedStandalonePublishPort.mockReturnValue(true);
    await publishToUrlsStandalone(["wss://relay-1.example", "wss://relay-2.example"], "payload");
    expect(mocks.publishToUrlsStandaloneSubtracted).toHaveBeenCalledWith(
      ["wss://relay-1.example", "wss://relay-2.example"],
      "payload",
    );
    expect(mocks.publishTransportKernelToRelayUrls).not.toHaveBeenCalled();
  });
});

