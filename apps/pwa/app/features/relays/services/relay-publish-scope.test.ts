import { describe, expect, it } from "vitest";
import type { RelayPoolLike } from "@/app/features/relays/lib/nostr-core-relay";
import {
  resolveOpenDmPublishPathRelayUrls,
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

  it("S1: drops local when an open remote exists among candidates", () => {
    const urls = resolveScopedPublishRelayUrls({
      relayUrls: ["wss://relay.damus.io", "ws://localhost:7000"],
      pool: poolWithOpenRelays(["wss://relay.damus.io", "ws://localhost:7000"]),
    });

    expect(urls).toEqual(["wss://relay.damus.io"]);
  });

  it("keeps open local when remotes are listed but none are open", () => {
    const urls = resolveScopedPublishRelayUrls({
      relayUrls: ["wss://relay.damus.io", "ws://localhost:7000"],
      pool: poolWithOpenRelays(["ws://localhost:7000"]),
    });

    expect(urls).toEqual(["wss://relay.damus.io", "ws://localhost:7000"]);
  });

  it("keeps local-only pool when no remotes are candidates", () => {
    const urls = resolveScopedPublishRelayUrls({
      relayUrls: ["ws://localhost:7000"],
      pool: poolWithOpenRelays(["ws://localhost:7000"]),
    });

    expect(urls).toEqual(["ws://localhost:7000"]);
  });

  it("S3: open publish path is open remotes when both local and remote are open", () => {
    const urls = resolveOpenDmPublishPathRelayUrls({
      relayUrls: ["wss://relay.damus.io", "ws://localhost:7000"],
      pool: poolWithOpenRelays(["wss://relay.damus.io", "ws://localhost:7000"]),
    });

    expect(urls).toEqual(["wss://relay.damus.io"]);
  });

  it("S3: open publish path is empty when scoped remotes are closed", () => {
    const urls = resolveOpenDmPublishPathRelayUrls({
      relayUrls: ["wss://relay.damus.io", "ws://localhost:7000"],
      pool: poolWithOpenRelays([]),
    });

    expect(urls).toEqual([]);
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
