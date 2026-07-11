import { describe, expect, it } from "vitest";
import type { RelayPoolLike } from "@/app/features/relays/lib/nostr-core-relay";
import {
  resolveScopedPublishRelayUrls,
  shouldWarnRelayPartialCoverage,
} from "./relay-publish-scope";

const poolWithOpenRelays = (openUrls: ReadonlyArray<string>): RelayPoolLike => ({
  connections: openUrls.map((url) => ({ url, status: "open" })),
  waitForConnection: async () => true,
});

describe("relay-publish-scope", () => {
  it("drops offline local dev relay from scoped publish when public relays remain", () => {
    const urls = resolveScopedPublishRelayUrls({
      relayUrls: ["wss://relay.damus.io", "ws://localhost:7000"],
      pool: poolWithOpenRelays(["wss://relay.damus.io"]),
    });

    expect(urls).toEqual(["wss://relay.damus.io"]);
  });

  it("keeps local dev relay when it is actually connected", () => {
    const urls = resolveScopedPublishRelayUrls({
      relayUrls: ["wss://relay.damus.io", "ws://localhost:7000"],
      pool: poolWithOpenRelays(["wss://relay.damus.io", "ws://localhost:7000"]),
    });

    expect(urls).toEqual(["wss://relay.damus.io", "ws://localhost:7000"]);
  });

  it("does not warn when quorum is met despite partial relay coverage", () => {
    expect(shouldWarnRelayPartialCoverage({
      successCount: 1,
      totalRelays: 2,
      metQuorum: true,
    })).toBe(false);
  });

  it("warns when quorum is not met", () => {
    expect(shouldWarnRelayPartialCoverage({
      successCount: 1,
      totalRelays: 3,
      metQuorum: false,
    })).toBe(true);
  });
});
