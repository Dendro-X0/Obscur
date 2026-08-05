import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  publishToRelayStandaloneSubtracted: vi.fn(async (url: string) => ({
    success: true,
    relayUrl: url,
  })),
  publishToUrlsStandaloneSubtracted: vi.fn(async (urls: ReadonlyArray<string>) => ({
    success: true,
    successCount: urls.length,
    totalRelays: urls.length,
    quorumRequired: 1,
    metQuorum: true,
    results: urls.map((relayUrl) => ({ success: true, relayUrl })),
    failures: [],
  })),
}));

vi.mock("./relay-standalone-publish-port-subtracted", () => ({
  publishToRelayStandaloneSubtracted: mocks.publishToRelayStandaloneSubtracted,
  publishToUrlsStandaloneSubtracted: mocks.publishToUrlsStandaloneSubtracted,
}));

import {
  publishToRelayStandalone,
  publishToUrlsStandalone,
} from "./relay-standalone-publish-port";

describe("relay-standalone-publish-port (thin after W66)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-exports single-relay publish to subtracted owner", async () => {
    await publishToRelayStandalone("wss://relay.example", "payload");
    expect(mocks.publishToRelayStandaloneSubtracted).toHaveBeenCalledWith("wss://relay.example", "payload");
  });

  it("re-exports multi-relay publish to subtracted owner", async () => {
    await publishToUrlsStandalone(["wss://relay-1.example", "wss://relay-2.example"], "payload");
    expect(mocks.publishToUrlsStandaloneSubtracted).toHaveBeenCalledWith(
      ["wss://relay-1.example", "wss://relay-2.example"],
      "payload",
    );
  });
});
