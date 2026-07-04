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

  it("uses only the primary in basic mode", () => {
    const selection = relaySelectorInternals.buildSelection(urls, urls[1]);
    const pool = resolveActivePoolRelayUrls({
      mode: "basic",
      orderedEnabledUrls: urls,
      selection,
      hints: [],
    });
    expect(pool).toEqual([urls[1]]);
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
});
