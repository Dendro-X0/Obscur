import { describe, expect, it } from "vitest";

import {
  filterDemotedLocalLabUrls,
  shouldDemoteLocalLabFromActivePool,
} from "./relay-local-lab-adapt";

describe("relay-local-lab-adapt (Nostr-first silo)", () => {
  const local = "ws://localhost:7000";

  it("does not demote when remotes are disabled (Soft L3-only)", () => {
    expect(shouldDemoteLocalLabFromActivePool({
      localUrl: local,
      remotesEnabled: false,
    })).toBe(false);
  });

  it("always demotes local lab when remotes are enabled (even cold / healthy)", () => {
    expect(shouldDemoteLocalLabFromActivePool({
      localUrl: local,
      remotesEnabled: true,
    })).toBe(true);
    expect(shouldDemoteLocalLabFromActivePool({
      localUrl: local,
      hint: { url: local, isOpen: true, isWritable: true, latencyMs: 12 },
      remotesEnabled: true,
    })).toBe(true);
  });

  it("does not demote public URLs", () => {
    expect(shouldDemoteLocalLabFromActivePool({
      localUrl: "wss://nos.lol",
      remotesEnabled: true,
    })).toBe(false);
  });

  it("filters localhost from ordered URLs when remotes enabled", () => {
    const filtered = filterDemotedLocalLabUrls({
      orderedEnabledUrls: [local, "wss://nos.lol"],
      remotesEnabled: true,
    });
    expect(filtered).toEqual(["wss://nos.lol"]);
  });

  it("keeps localhost when Soft L3-only", () => {
    const filtered = filterDemotedLocalLabUrls({
      orderedEnabledUrls: [local],
      remotesEnabled: false,
    });
    expect(filtered).toEqual([local]);
  });
});
