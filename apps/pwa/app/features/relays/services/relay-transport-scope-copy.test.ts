import { describe, expect, it } from "vitest";

import {
  getActivePoolScopeSummaryCopy,
  getActiveTransportScopeCopy,
  getDmPublishPathCopy,
  getTorEmptyPoolHonestyCopy,
  resolveActivePoolScopeSummaryCounts,
} from "./relay-transport-scope-copy";

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

  it("S3: publish path copy lists open hosts and none-open", () => {
    expect(getDmPublishPathCopy({
      publishPathRelayUrls: ["wss://relay.primal.net", "wss://nos.lol"],
    })).toBe("DM publish path: relay.primal.net, nos.lol");
    expect(getDmPublishPathCopy({
      publishPathRelayUrls: [],
    })).toBe("DM publish path: none open");
  });

  it("S3: active transport copy appends publish path when provided", () => {
    const copy = getActiveTransportScopeCopy({
      selection: {
        primaryUrl: "wss://nos.lol",
        standbyUrls: ["wss://relay.primal.net"],
        entries: [],
      },
      transportMode: "basic",
      activePoolRelayUrls: ["wss://nos.lol", "ws://localhost:7000"],
      writableRelayCount: 2,
      subscribableRelayCount: 2,
      enabledRelayCount: 3,
      publishPathRelayUrls: ["wss://relay.primal.net"],
    });
    expect(copy).toContain("Nostr active transport");
    expect(copy).toContain("DM publish path: relay.primal.net");
  });

  it("counts Local Dev Mesh in DM transport pool summary (not partition dm=0)", () => {
    const counts = resolveActivePoolScopeSummaryCounts([
      { url: "ws://localhost:7000", enabled: true },
    ]);
    expect(counts.dmPoolEnabledCount).toBe(1);
    expect(counts.communityEnabledCount).toBe(1);
    expect(getActivePoolScopeSummaryCopy(counts)).toContain("DM transport pool: 1");
    expect(getActivePoolScopeSummaryCopy(counts)).toContain("Workspace candidates: 1 enabled");
  });

  it("T5-2/TI-3: Tor-armed counts Tor-viable DM pool (subtracts CF)", () => {
    const counts = resolveActivePoolScopeSummaryCounts([
      { url: "wss://nos.lol", enabled: true },
      { url: "wss://relay.damus.io", enabled: true },
    ], { torArmed: true });
    expect(counts.dmPoolEnabledCount).toBe(0);
    expect(getTorEmptyPoolHonestyCopy()).toContain("Tor is on");
  });

  it("TI-3: Warming (preference without armed) keeps clearnet pool counts", () => {
    const counts = resolveActivePoolScopeSummaryCounts([
      { url: "wss://nos.lol", enabled: true },
      { url: "wss://relay.damus.io", enabled: true },
    ], { torArmed: false });
    expect(counts.dmPoolEnabledCount).toBe(2);
  });
});
