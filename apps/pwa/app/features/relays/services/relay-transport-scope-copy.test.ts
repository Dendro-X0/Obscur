import { describe, expect, it } from "vitest";

import { getActiveTransportScopeCopy } from "./relay-transport-scope-copy";

describe("relay transport scope copy", () => {
  it("summarizes active transport scope for settings", () => {
    expect(getActiveTransportScopeCopy({
      selection: {
        primaryUrl: "wss://relay.damus.io",
        standbyUrls: ["wss://nos.lol"],
        entries: [],
      },
      transportMode: "basic",
      activePoolRelayUrls: ["wss://relay.damus.io"],
      writableRelayCount: 1,
      subscribableRelayCount: 1,
      enabledRelayCount: 3,
    })).toContain("Nostr active transport");
    expect(getActiveTransportScopeCopy({
      selection: {
        primaryUrl: "wss://relay.damus.io",
        standbyUrls: [],
        entries: [],
      },
      transportMode: "basic",
      activePoolRelayUrls: ["wss://relay.damus.io"],
      writableRelayCount: 0,
      subscribableRelayCount: 0,
      enabledRelayCount: 2,
    })).toContain("publish-ready 0");

    expect(getActiveTransportScopeCopy({
      selection: {
        primaryUrl: "wss://relay.damus.io",
        standbyUrls: ["wss://nos.lol"],
        entries: [],
      },
      transportMode: "redundancy",
      activePoolRelayUrls: ["wss://relay.damus.io", "wss://nos.lol"],
      writableRelayCount: 2,
      subscribableRelayCount: 2,
      enabledRelayCount: 3,
    })).toContain("Nostr redundancy pool");
  });
});
