import { describe, expect, it } from "vitest";
import { DiscoveryEngine, discoveryEngineInternals, QueryPlanner, ResultMerger } from "./discovery-engine";
import type { RelayQueryPool } from "./relay-discovery-query";

const createMockPool = (): RelayQueryPool => ({
  broadcastEvent: async () => ({ success: false }),
  sendToOpen: () => {},
  subscribeToMessages: () => () => {},
  waitForConnection: async () => true,
});

describe("discovery-engine", () => {
  it("classifies invite code as resolve_invite", () => {
    const plan = QueryPlanner.classifyQuery("add_friend", "OBSCUR-RW8NXD");
    expect(plan.queryKind).toBe("invite_code");
    expect(plan.effectiveIntent).toBe("resolve_invite");
  });

  it("classifies pubkey input as resolve_card", () => {
    const plan = QueryPlanner.classifyQuery("add_friend", "a".repeat(64));
    expect(plan.queryKind).toBe("pubkey");
    expect(plan.effectiveIntent).toBe("resolve_card");
  });

  it("dedupes merged results by canonical id", () => {
    const merged = ResultMerger.mergeResults([
      {
        canonicalId: "x",
        kind: "person",
        display: { title: "Alice", pubkey: "x" },
        confidence: "cached_only",
        sources: ["local"],
        score: 50,
        freshnessUnixMs: 1,
      },
      {
        canonicalId: "x",
        kind: "person",
        display: { title: "Alice", description: "Relay copy", pubkey: "x" },
        confidence: "relay_confirmed",
        sources: ["relay"],
        score: 70,
        freshnessUnixMs: 2,
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.sources).toContain("local");
    expect(merged[0]?.sources).toContain("relay");
    expect(merged[0]?.confidence).toBe("relay_confirmed");
  });

  it("parses index payload with people + communities arrays", () => {
    const parsed = discoveryEngineInternals.parseIndexRecords({
      people: [{ pubkey: "a".repeat(64), name: "Alice" }],
      communities: [{ communityId: "cypher", relayUrl: "wss://relay.example" }],
    });
    expect(parsed.people?.[0]?.pubkey).toBe("a".repeat(64));
    expect(parsed.communities?.[0]?.communityId).toBe("cypher");
  });

  it("returns a direct person result immediately for hex pubkey lookup", async () => {
    const result = await DiscoveryEngine.run({
      query: "a".repeat(64),
      intent: "search_people",
      pool: createMockPool(),
      relayTimeoutMs: 1,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      canonicalId: "a".repeat(64),
      kind: "person",
      confidence: "direct",
      display: {
        pubkey: "a".repeat(64),
        title: "aaaaaaaaaaaa",
      },
    });
  });

  it("returns a direct person result immediately for npub lookup", async () => {
    const result = await DiscoveryEngine.run({
      query: "npub1424242424242424242424242424242424242424242424242424qamrcaj",
      intent: "search_people",
      pool: createMockPool(),
      relayTimeoutMs: 1,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.kind).toBe("person");
    expect(result.results[0]?.confidence).toBe("direct");
    expect(result.results[0]?.display.pubkey).toBe("a".repeat(64));
  });

  it("skips relay lookup immediately when no writable relays are available", async () => {
    const pool: RelayQueryPool = {
      ...createMockPool(),
      waitForConnection: async () => {
        throw new Error("relay lookup should be skipped");
      },
    };

    const result = await DiscoveryEngine.run({
      query: "alice",
      intent: "search_people",
      pool,
      relayTimeoutMs: 1,
      skipRelayLookup: true,
    });

    expect(result.results).toHaveLength(0);
    expect(result.state.phase).toBe("degraded");
    expect(result.state.reasonCode).toBe("relay_degraded");
    expect(result.state.sourceStatusMap.relay.state).toBe("skipped");
  });
});
