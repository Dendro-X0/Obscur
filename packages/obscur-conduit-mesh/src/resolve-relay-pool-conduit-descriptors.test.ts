import { describe, expect, it } from "vitest";
import {
  prioritizeLocalDevWarmupUrls,
  resolveRelayPoolConduitDescriptors,
} from "./resolve-relay-pool-conduit-descriptors";

describe("prioritizeLocalDevWarmupUrls", () => {
  it("orders localhost before public remotes for configure warm-up", () => {
    expect(prioritizeLocalDevWarmupUrls([
      "wss://relay.damus.io",
      "ws://localhost:7000",
      "wss://nos.lol",
    ])).toEqual([
      "ws://localhost:7000",
      "wss://relay.damus.io",
      "wss://nos.lol",
    ]);
  });

  it("assigns lower priority index to local-dev descriptors first", () => {
    const descriptors = resolveRelayPoolConduitDescriptors([
      "wss://nos.lol",
      "ws://localhost:7000",
    ]);
    expect(descriptors[0]?.endpoints[0]).toBe("ws://localhost:7000");
    expect(descriptors[0]?.priority).toBe(0);
    expect(descriptors[1]?.endpoints[0]).toBe("wss://nos.lol");
  });
});
