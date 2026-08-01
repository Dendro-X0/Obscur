import { describe, expect, it } from "vitest";

import {
  pickBestRelayUrl,
  reconcilePrimarySelection,
  resolveActivePoolRelayUrls,
  resolveFailoverRelaySelection,
  resolveInitialRelaySelection,
  relaySelectorInternals,
  scoreRelayUrl,
} from "./relay-primary-selector";

describe("relay primary selector", () => {
  const urls = ["ws://localhost:7000", "wss://relay.damus.io", "wss://nos.lol"];

  it("promotes the best open standby when primary fails", () => {
    const current = relaySelectorInternals.buildSelection(urls, urls[0]);
    const hints = [
      { url: urls[0], isOpen: false, isCircuitOpen: true, listIndex: 0 },
      { url: urls[1], isOpen: true, isWritable: true, latencyMs: 200, successRate: 100, listIndex: 1 },
      { url: urls[2], isOpen: true, isWritable: true, latencyMs: 400, successRate: 100, listIndex: 2 },
    ];

    const next = resolveFailoverRelaySelection(current, urls, hints);
    expect(next.primaryUrl).toBe(urls[1]);
  });

  it("skips circuit-open relays when scoring", () => {
    const hints = [
      { url: urls[0], isOpen: false, isCircuitOpen: true, listIndex: 0 },
      { url: urls[1], isOpen: true, isWritable: true, latencyMs: 200, successRate: 100, listIndex: 1 },
    ];
    expect(scoreRelayUrl(urls[0], hints, urls)).toBe(0);
    expect(scoreRelayUrl(urls[1], hints, urls)).toBeGreaterThan(0);
    expect(pickBestRelayUrl(urls, hints)).toBe(urls[1]);
  });

  it("reconciles away from a circuit-open primary", () => {
    const current = relaySelectorInternals.buildSelection(urls, urls[0]);
    const hints = [
      { url: urls[0], isOpen: false, isCircuitOpen: true, listIndex: 0 },
      { url: urls[1], isOpen: true, isWritable: true, latencyMs: 150, successRate: 100, listIndex: 1 },
    ];
    const next = reconcilePrimarySelection(current, urls, hints);
    expect(next?.primaryUrl).toBe(urls[1]);
  });

  it("keeps the best primary instead of rotating away during recovery", () => {
    const hints = [
      { url: urls[1], isOpen: true, isWritable: true, latencyMs: 200, successRate: 100, listIndex: 1 },
      { url: urls[2], isOpen: true, isWritable: true, latencyMs: 900, successRate: 100, listIndex: 2 },
    ];
    const current = relaySelectorInternals.buildSelection(urls, urls[1]);
    expect(reconcilePrimarySelection(current, urls, hints)).toBeNull();
    expect(resolveFailoverRelaySelection(current, urls, hints).primaryUrl).toBe(urls[2]);
  });

  it("uses redundancy pool for top scored relays", () => {
    const selection = resolveInitialRelaySelection(urls, [
      { url: urls[0], isOpen: false, isCircuitOpen: true, listIndex: 0 },
      { url: urls[1], isOpen: true, isWritable: true, latencyMs: 120, successRate: 100, listIndex: 1 },
      { url: urls[2], isOpen: true, isWritable: true, latencyMs: 180, successRate: 100, listIndex: 2 },
    ]);
    const pool = resolveActivePoolRelayUrls({
      mode: "redundancy",
      orderedEnabledUrls: urls,
      selection,
      hints: [
        { url: urls[0], isOpen: false, isCircuitOpen: true, listIndex: 0 },
        { url: urls[1], isOpen: true, isWritable: true, latencyMs: 120, successRate: 100, listIndex: 1 },
        { url: urls[2], isOpen: true, isWritable: true, latencyMs: 180, successRate: 100, listIndex: 2 },
      ],
    });
    expect(pool).toEqual([urls[1], urls[2]]);
  });

  it("uses only the primary in basic mode when hints are empty or primary is live", () => {
    const selection = relaySelectorInternals.buildSelection(urls, urls[1]);
    expect(resolveActivePoolRelayUrls({
      mode: "basic",
      orderedEnabledUrls: urls,
      selection,
      hints: [],
    })).toEqual([urls[1]]);
    expect(resolveActivePoolRelayUrls({
      mode: "basic",
      orderedEnabledUrls: urls,
      selection,
      hints: [
        { url: urls[0], isOpen: true, isWritable: true, listIndex: 0 },
        { url: urls[1], isOpen: true, isWritable: true, listIndex: 1 },
      ],
    })).toEqual([urls[1]]);
  });

  it("E2c: promotes open local but keeps dialing dead public primary for remote interaction", () => {
    const selection = relaySelectorInternals.buildSelection(
      ["wss://relay.damus.io", "ws://localhost:7000"],
      "wss://relay.damus.io",
    );
    const pool = resolveActivePoolRelayUrls({
      mode: "basic",
      orderedEnabledUrls: ["wss://relay.damus.io", "ws://localhost:7000"],
      selection,
      hints: [
        { url: "wss://relay.damus.io", isOpen: false, isWritable: false, listIndex: 0 },
        { url: "ws://localhost:7000", isOpen: true, isWritable: true, latencyMs: 20, successRate: 100, listIndex: 1 },
      ],
    });
    expect(pool[0]).toBe("wss://relay.damus.io");
    expect(pool).toContain("ws://localhost:7000");
    expect(pool.length).toBeGreaterThanOrEqual(2);
  });

  it("E2c: pads additional remotes when local is promoted and more public URLs are enabled", () => {
    const ordered = ["wss://nos.lol", "wss://relay.primal.net", "ws://localhost:7000"];
    const selection = relaySelectorInternals.buildSelection(ordered, "wss://nos.lol");
    const pool = resolveActivePoolRelayUrls({
      mode: "basic",
      orderedEnabledUrls: ordered,
      selection,
      hints: [
        { url: "wss://nos.lol", isOpen: false, isWritable: false, listIndex: 0 },
        { url: "wss://relay.primal.net", isOpen: false, isWritable: false, listIndex: 1 },
        { url: "ws://localhost:7000", isOpen: true, isWritable: true, latencyMs: 20, successRate: 100, listIndex: 2 },
      ],
    });
    expect(pool).toContain("ws://localhost:7000");
    expect(pool).toContain("wss://nos.lol");
    expect(pool).toContain("wss://relay.primal.net");
    expect(pool.some((url) => url.startsWith("wss://"))).toBe(true);
  });

  it("E2c: redundancy never leaves a local-only pool when remotes are enabled", () => {
    const ordered = ["ws://localhost:7000", "wss://nos.lol"];
    const selection = relaySelectorInternals.buildSelection(ordered, "ws://localhost:7000");
    const pool = resolveActivePoolRelayUrls({
      mode: "redundancy",
      orderedEnabledUrls: ordered,
      selection,
      maxRedundancy: 1,
      hints: [
        { url: "ws://localhost:7000", isOpen: true, isWritable: true, latencyMs: 10, successRate: 100, listIndex: 0 },
        { url: "wss://nos.lol", isOpen: false, isWritable: false, listIndex: 1 },
      ],
    });
    expect(pool).toEqual(["wss://nos.lol"]);
  });

  it("E2: pads one cold standby into basic dial set when primary is dead", () => {
    const ordered = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
    const selection = relaySelectorInternals.buildSelection(ordered, ordered[0]!);
    const pool = resolveActivePoolRelayUrls({
      mode: "basic",
      orderedEnabledUrls: ordered,
      selection,
      hints: ordered.map((url, listIndex) => ({
        url,
        isOpen: false,
        isWritable: false,
        listIndex,
      })),
    });
    expect(pool).toEqual(["wss://relay.damus.io", "wss://nos.lol"]);
  });

  it("E2: does not pad circuit-open standbys into basic dial set", () => {
    const ordered = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
    const selection = relaySelectorInternals.buildSelection(ordered, ordered[0]!);
    const pool = resolveActivePoolRelayUrls({
      mode: "basic",
      orderedEnabledUrls: ordered,
      selection,
      hints: [
        { url: ordered[0]!, isOpen: false, isWritable: false, listIndex: 0 },
        { url: ordered[1]!, isOpen: false, isWritable: false, isCircuitOpen: true, listIndex: 1 },
        { url: ordered[2]!, isOpen: false, isWritable: false, listIndex: 2 },
      ],
    });
    expect(pool).toEqual(["wss://relay.damus.io", "wss://relay.primal.net"]);
  });

  it("reconciles primary to open local when public primary is disconnected", () => {
    const ordered = ["wss://relay.damus.io", "ws://localhost:7000"];
    const current = relaySelectorInternals.buildSelection(ordered, "wss://relay.damus.io");
    const next = reconcilePrimarySelection(current, ordered, [
      { url: "wss://relay.damus.io", isOpen: false, isWritable: false, listIndex: 0 },
      { url: "ws://localhost:7000", isOpen: true, isWritable: true, latencyMs: 20, successRate: 100, listIndex: 1 },
    ]);
    expect(next?.primaryUrl).toBe("ws://localhost:7000");
  });

  it("pads redundancy pool with cold standbys when only the primary still scores", () => {
    const selection = relaySelectorInternals.buildSelection(urls, urls[1]);
    const pool = resolveActivePoolRelayUrls({
      mode: "redundancy",
      orderedEnabledUrls: urls,
      selection,
      hints: [
        { url: urls[0], isOpen: false, isWritable: false, listIndex: 0 },
        { url: urls[1], isOpen: true, isWritable: true, latencyMs: 120, successRate: 100, listIndex: 1 },
        { url: urls[2], isOpen: false, isWritable: false, listIndex: 2 },
      ],
    });
    expect(pool[0]).toBe(urls[1]);
    expect(pool).toContain(urls[0]);
    expect(pool).toContain(urls[2]);
    expect(pool).toHaveLength(3);
  });

  it("fills redundancy pool from ordered list when every relay scores zero", () => {
    const selection = relaySelectorInternals.buildSelection(urls, urls[0]);
    const pool = resolveActivePoolRelayUrls({
      mode: "redundancy",
      orderedEnabledUrls: urls,
      selection,
      hints: urls.map((url, listIndex) => ({
        url,
        isOpen: false,
        isWritable: false,
        listIndex,
      })),
    });
    expect(pool).toEqual(urls);
  });

  it("does not pad circuit-open relays into the redundancy pool", () => {
    const selection = relaySelectorInternals.buildSelection(urls, urls[1]);
    const pool = resolveActivePoolRelayUrls({
      mode: "redundancy",
      orderedEnabledUrls: urls,
      selection,
      hints: [
        { url: urls[0], isOpen: false, isCircuitOpen: true, listIndex: 0 },
        { url: urls[1], isOpen: true, isWritable: true, latencyMs: 120, successRate: 100, listIndex: 1 },
        { url: urls[2], isOpen: false, isWritable: false, listIndex: 2 },
      ],
    });
    expect(pool).toEqual([urls[1], urls[2]]);
    expect(pool).not.toContain(urls[0]);
  });

  it("prefers public relays over local dev on cold start when all hints are disconnected", () => {
    const hints = urls.map((url, listIndex) => ({
      url,
      isOpen: false,
      isWritable: false,
      listIndex,
    }));
    expect(pickBestRelayUrl(urls, hints)).toBe(urls[1]);
    expect(resolveInitialRelaySelection(urls, hints).primaryUrl).toBe(urls[1]);
  });

  it("E3/P6: ranks remotes by probe health even when damus is first in Settings order", () => {
    const ordered = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
    const hints = [
      { url: "wss://relay.damus.io", isOpen: false, isWritable: false, latencyMs: 2800, successRate: 40, listIndex: 0 },
      { url: "wss://nos.lol", isOpen: true, isWritable: false, latencyMs: 40, successRate: 100, listIndex: 1 },
      { url: "wss://relay.primal.net", isOpen: true, isWritable: false, latencyMs: 55, successRate: 100, listIndex: 2 },
    ];
    const ranked = relaySelectorInternals.rankEnabledRelayUrlsForDial(ordered, hints);
    expect(ranked[0]).toBe("wss://nos.lol");
    expect(ranked.indexOf("wss://nos.lol")).toBeLessThan(ranked.indexOf("wss://relay.damus.io"));

    const remotes = relaySelectorInternals.collectRemoteDialUrls(ordered, hints);
    expect(remotes[0]).toBe("wss://nos.lol");
  });

  it("E3/P6: basic mode promotes probe-healthy standby when primary is dead", () => {
    const ordered = ["wss://relay.damus.io", "wss://relay.primal.net", "wss://nos.lol"];
    const selection = relaySelectorInternals.buildSelection(ordered, "wss://relay.damus.io");
    const pool = resolveActivePoolRelayUrls({
      mode: "basic",
      orderedEnabledUrls: ordered,
      selection,
      hints: [
        { url: "wss://relay.damus.io", isOpen: false, isWritable: false, listIndex: 0 },
        { url: "wss://relay.primal.net", isOpen: false, isWritable: false, latencyMs: 900, successRate: 50, listIndex: 1 },
        { url: "wss://nos.lol", isOpen: true, isWritable: false, latencyMs: 35, successRate: 100, listIndex: 2 },
      ],
    });
    expect(pool).toEqual(["wss://nos.lol"]);
  });

  it("E3/P6: basic cold pad prefers remote clearnet over local lab neighbor", () => {
    const ordered = ["wss://relay.damus.io", "ws://localhost:7000", "wss://nos.lol"];
    const selection = relaySelectorInternals.buildSelection(ordered, "wss://relay.damus.io");
    const pool = resolveActivePoolRelayUrls({
      mode: "basic",
      orderedEnabledUrls: ordered,
      selection,
      hints: [
        { url: "wss://relay.damus.io", isOpen: false, isWritable: false, listIndex: 0 },
        { url: "ws://localhost:7000", isOpen: false, isWritable: false, listIndex: 1 },
        { url: "wss://nos.lol", isOpen: false, isWritable: false, listIndex: 2 },
      ],
    });
    expect(pool).toEqual(["wss://relay.damus.io", "wss://nos.lol"]);
  });
});
