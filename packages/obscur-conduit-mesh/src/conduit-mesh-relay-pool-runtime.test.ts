import { describe, expect, it } from "vitest";

import { createConduitMeshRelayPoolRuntime } from "./conduit-mesh-relay-pool-runtime";
import { createInMemoryConduitFetchRouter } from "./in-memory-conduit-fetch-router";

describe("conduit-mesh relay pool runtime", () => {
  it("maps publishToUrls to mesh drivers with quorum semantics", async () => {
    const fetch = createInMemoryConduitFetchRouter({
      coordinationBaseUrl: "http://127.0.0.1:8787",
      teamRelayBaseUrl: "http://127.0.0.1:8788",
    });

    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "pool-test",
      fetch,
      now: () => 1_700_000_300_000,
    });

    await runtime.configureUrls([
      "http://127.0.0.1:8788",
      "http://127.0.0.1:8788",
    ]);

    const result = await runtime.publishToUrls(
      ["http://127.0.0.1:8788", "http://127.0.0.1:8788"],
      "nostr-wire-payload-stub",
      { quorumRequired: 1 },
    );

    expect(result.metQuorum).toBe(true);
    expect(result.successCount).toBeGreaterThanOrEqual(1);

    const activity = await runtime.getTransportActivitySnapshot();
    expect(activity.writableRelayCount).toBeGreaterThanOrEqual(0);
  });
});
