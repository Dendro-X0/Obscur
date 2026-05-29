import { describe, expect, it } from "vitest";

import {
  mergeNostrPoolWithCustomNodeRelayUrls,
  resolveEnabledCustomNodeRelayUrls,
} from "./relay-custom-node-pool";

describe("relay custom node pool", () => {
  it("merges Nostr active pool with custom nodes without duplicating URLs", () => {
    const merged = mergeNostrPoolWithCustomNodeRelayUrls({
      nostrActivePoolRelayUrls: ["wss://relay.damus.io"],
      customNodeRelayUrls: ["ws://localhost:7000", "wss://relay.damus.io"],
    });
    expect(merged).toEqual(["wss://relay.damus.io", "ws://localhost:7000"]);
  });

  it("keeps custom nodes when Nostr basic mode uses one relay only", () => {
    const merged = mergeNostrPoolWithCustomNodeRelayUrls({
      nostrActivePoolRelayUrls: ["wss://nos.lol"],
      customNodeRelayUrls: ["ws://localhost:7000"],
    });
    expect(merged).toEqual(["wss://nos.lol", "ws://localhost:7000"]);
  });

  it("dedupes community candidates with explicit operator relay override", () => {
    const custom = resolveEnabledCustomNodeRelayUrls({
      communityCandidateRelayUrls: ["ws://localhost:7000"],
      operatorWorkspaceRelayUrl: "ws://localhost:7000",
    });
    expect(custom).toEqual(["ws://localhost:7000"]);
  });
});
