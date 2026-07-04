import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/experiment-shell-policy", () => ({
  isExperimentOnlineEnabled: vi.fn(() => false),
}));

import { isExperimentOnlineEnabled } from "@/app/features/runtime/experiment-shell-policy";
import {
  applyRelayListScopeMigration,
  classifyRelayTransportScope,
  isCommunityRelayCandidateUrl,
  isDmTransportRelayUrl,
  isPrivateOrIntranetRelayUrl,
  partitionRelayListByTransportScope,
  resolveDmTransportRelayUrls,
} from "./relay-transport-scope";

describe("relay-transport-scope", () => {
  it("classifies public defaults as DM transport", () => {
    expect(isDmTransportRelayUrl("wss://relay.damus.io")).toBe(true);
    expect(classifyRelayTransportScope("wss://relay.damus.io")).toBe("dm");
    expect(isCommunityRelayCandidateUrl("wss://relay.damus.io")).toBe(false);
  });

  it("classifies private and intranet hosts as community candidates", () => {
    expect(isPrivateOrIntranetRelayUrl("ws://localhost:7000")).toBe(true);
    expect(isCommunityRelayCandidateUrl("ws://localhost:7000")).toBe(true);
    expect(isDmTransportRelayUrl("ws://localhost:7000")).toBe(false);
    expect(classifyRelayTransportScope("wss://relay.team.internal")).toBe("community_candidate");
  });

  it("classifies custom team relays as community candidates", () => {
    expect(isCommunityRelayCandidateUrl("wss://relay.team.example")).toBe(true);
    expect(isDmTransportRelayUrl("wss://relay.team.example")).toBe(false);
  });

  it("resolves DM transport URLs from enabled list only", () => {
    vi.mocked(isExperimentOnlineEnabled).mockReturnValue(false);
    const urls = resolveDmTransportRelayUrls([
      { url: "wss://relay.damus.io", enabled: true },
      { url: "ws://localhost:7000", enabled: true },
      { url: "wss://relay.damus.io", enabled: false },
    ]);
    expect(urls).toEqual(["wss://relay.damus.io"]);
  });

  it("appends enabled local dev relay after public DM relays when experiment online is set", () => {
    vi.mocked(isExperimentOnlineEnabled).mockReturnValue(true);
    const urls = resolveDmTransportRelayUrls([
      { url: "wss://relay.damus.io", enabled: true },
      { url: "ws://localhost:7000", enabled: true },
      { url: "wss://nos.lol", enabled: true },
    ]);
    expect(urls).toEqual([
      "wss://relay.damus.io",
      "wss://nos.lol",
      "ws://localhost:7000",
    ]);
  });

  it("partitions relay list for settings UI", () => {
    const partitioned = partitionRelayListByTransportScope([
      { url: "wss://nos.lol", enabled: true },
      { url: "ws://localhost:7000", enabled: false },
      { url: "wss://relay.team.example", enabled: true },
    ]);
    expect(partitioned.dm.map((entry) => entry.url)).toEqual(["wss://nos.lol"]);
    expect(partitioned.community.map((entry) => entry.url)).toEqual([
      "ws://localhost:7000",
      "wss://relay.team.example",
    ]);
  });

  it("disables private relays during storage migration", () => {
    const migrated = applyRelayListScopeMigration([
      { url: "wss://relay.damus.io", enabled: true },
      { url: "ws://localhost:7000", enabled: true },
    ]);
    expect(migrated).toEqual([
      { url: "wss://relay.damus.io", enabled: true },
      { url: "ws://localhost:7000", enabled: false },
    ]);
  });
});
