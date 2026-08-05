import { describe, expect, it } from "vitest";

import {
  applyRelayListScopeMigration,
  classifyRelayTransportScope,
  isCommunityRelayCandidateUrl,
  isDmTransportRelayUrl,
  isLocalMeshHttpGatewayUrl,
  isPrivateOrIntranetRelayUrl,
  partitionRelayListByTransportScope,
  resolveDmAdapterListEntries,
  resolveDmTransportRelayUrls,
  mergePublicBootIntoLoopbackOnlyList,
  isLoopbackOnlyRelayList,
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

  it("resolves DM transport URLs from enabled public list and appends enabled local-dev fallback", () => {
    const urls = resolveDmTransportRelayUrls([
      { url: "wss://relay.damus.io", enabled: true },
      { url: "ws://localhost:7000", enabled: true },
      { url: "wss://relay.damus.io", enabled: false },
    ]);
    expect(urls).toEqual(["wss://relay.damus.io", "ws://localhost:7000"]);
  });

  it("appends enabled local dev relay after public DM relays without experiment-online gate", () => {
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

  it("excludes disabled local-dev from DM pool", () => {
    const urls = resolveDmTransportRelayUrls([
      { url: "wss://relay.damus.io", enabled: true },
      { url: "ws://localhost:7000", enabled: false },
    ]);
    expect(urls).toEqual(["wss://relay.damus.io"]);
  });

  it("recognizes loopback mesh HTTP gateways", () => {
    expect(isLocalMeshHttpGatewayUrl("http://127.0.0.1:8788")).toBe(true);
    expect(isLocalMeshHttpGatewayUrl("https://localhost:8788")).toBe(true);
    expect(isLocalMeshHttpGatewayUrl("ws://127.0.0.1:8788")).toBe(false);
    expect(isLocalMeshHttpGatewayUrl("http://192.168.1.10:8788")).toBe(false);
  });

  it("promotes enabled loopback mesh HTTP into DM pool when public DM list is empty", () => {
    const urls = resolveDmTransportRelayUrls([
      { url: "http://127.0.0.1:8788", enabled: true },
      { url: "wss://relay.damus.io", enabled: false },
    ]);
    expect(urls).toEqual(["http://127.0.0.1:8788"]);
  });

  it("appends enabled loopback mesh HTTP after public DM relays", () => {
    const urls = resolveDmTransportRelayUrls([
      { url: "wss://relay.damus.io", enabled: true },
      { url: "http://127.0.0.1:8788", enabled: true },
    ]);
    expect(urls).toEqual([
      "wss://relay.damus.io",
      "http://127.0.0.1:8788",
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

  it("lists enabled local-dev under DM adapters when it joins the DM pool", () => {
    const relays = [
      { url: "ws://localhost:7000", enabled: true },
    ];
    expect(resolveDmTransportRelayUrls(relays)).toEqual(["ws://localhost:7000"]);
    expect(resolveDmAdapterListEntries(relays).map((entry) => entry.url)).toEqual([
      "ws://localhost:7000",
    ]);
  });

  it("merges public boot rows into loopback-only stored lists", () => {
    const { relays, changed } = mergePublicBootIntoLoopbackOnlyList(
      [{ url: "ws://localhost:7080", enabled: true }],
      [
        { url: "wss://nos.lol", enabled: true },
        { url: "wss://relay.primal.net", enabled: true },
      ],
    );
    expect(changed).toBe(true);
    expect(relays.map((entry) => entry.url)).toEqual([
      "wss://nos.lol",
      "wss://relay.primal.net",
      "ws://localhost:7080",
    ]);
    expect(isLoopbackOnlyRelayList(relays)).toBe(false);
  });

  it("does not force-merge intentional non-loopback private lists", () => {
    const { changed } = mergePublicBootIntoLoopbackOnlyList(
      [{ url: "ws://192.168.0.100:7000", enabled: true }],
      [{ url: "wss://nos.lol", enabled: true }],
    );
    expect(changed).toBe(false);
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
