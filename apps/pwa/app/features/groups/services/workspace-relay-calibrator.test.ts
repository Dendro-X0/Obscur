import { describe, expect, it, vi } from "vitest";

import {
  calibrateWorkspaceRelayUrl,
  dedupeRelayListByWorkspaceIdentity,
} from "./workspace-relay-calibrator";

describe("workspace relay calibrator", () => {
  it("picks the lowest-latency reachable candidate", async () => {
    const result = await calibrateWorkspaceRelayUrl({
      rawUrl: "wss://localhost:7000",
      probe: async (relayUrl) => ({
        ok: relayUrl === "ws://localhost:7000",
        latencyMs: relayUrl === "ws://localhost:7000" ? 40 : 200,
      }),
    });

    expect(result.canonicalUrl).toBe("ws://localhost:7000");
    expect(result.calibrated).toBe(false);
    expect(result.connected).toBe(true);
    expect(result.probeLatencyMs).toBe(40);
  });

  it("falls back to normalized url when no candidate connects", async () => {
    const result = await calibrateWorkspaceRelayUrl({
      rawUrl: "localhost:7000",
      probe: async () => ({ ok: false, latencyMs: 5000 }),
    });

    expect(result.canonicalUrl).toBe("ws://localhost:7000");
    expect(result.connected).toBe(false);
    expect(result.calibrated).toBe(false);
  });

  it("uses existing writable pool snapshot without probing", async () => {
    const probe = vi.fn(async () => ({ ok: false, latencyMs: 5000 }));
    const result = await calibrateWorkspaceRelayUrl({
      rawUrl: "ws://localhost:7000",
      pool: {
        getWritableRelaySnapshot: () => ({
          writableRelayUrls: ["ws://127.0.0.1:7000"],
        }),
      },
      probe,
    });

    expect(result.connected).toBe(true);
    expect(result.canonicalUrl).toBe("ws://127.0.0.1:7000");
    expect(probe).not.toHaveBeenCalled();
  });

  it("dedupes relay list entries that refer to the same local relay", () => {
    const deduped = dedupeRelayListByWorkspaceIdentity([
      { url: "wss://localhost:7000", enabled: false },
      { url: "localhost:7000", enabled: true },
      { url: "ws://127.0.0.1:7000", enabled: false },
      { url: "wss://relay.damus.io", enabled: true },
    ]);

    expect(deduped).toHaveLength(2);
    const localEntry = deduped.find((entry) => entry.url.includes("7000"));
    expect(localEntry?.enabled).toBe(true);
    expect(localEntry?.url).toBe("ws://127.0.0.1:7000");
    expect(deduped.find((entry) => entry.url.includes("damus"))?.url).toBe("wss://relay.damus.io");
  });
});
