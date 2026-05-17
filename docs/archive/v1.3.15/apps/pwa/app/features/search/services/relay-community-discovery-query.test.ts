import { describe, expect, it } from "vitest";
import { relayCommunityDiscoveryInternals } from "./relay-community-discovery-query";

describe("relay-community-discovery-query", () => {
  it("builds community filters with search + fallback window", () => {
    const filters = relayCommunityDiscoveryInternals.buildFilters("privacy");
    expect(filters).toHaveLength(2);
    expect(filters[0]).toMatchObject({ kinds: [39000], search: "privacy" });
    expect(typeof filters[1]?.since).toBe("number");
  });

  it("parses a kind-39000 community event", () => {
    const parsed = relayCommunityDiscoveryInternals.parseCommunityEvent({
      relayUrl: "wss://relay.example",
      event: {
        tags: [
          ["d", "cypher"],
          ["name", "Cypher Club"],
          ["about", "Privacy-first community"],
          ["picture", "https://example.com/community.png"],
        ],
      },
    });
    expect(parsed?.communityId).toBe("cypher");
    expect(parsed?.name).toBe("Cypher Club");
    expect(parsed?.access).toBe("open");
  });
});
