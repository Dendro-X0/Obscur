import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInPoolRttSubscriptionId,
  resolveHandshakeProbeUrls,
  runInPoolAppRttCycle,
} from "./in-pool-app-rtt-probe";

describe("runInPoolAppRttCycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("records per-url RTT from EOSE on open sockets", async () => {
    vi.useFakeTimers();
    let now = 1_000;
    const sent: string[] = [];
    const handlers: Array<(params: Readonly<{ url: string; message: string }>) => void> = [];

    const promise = runInPoolAppRttCycle({
      openUrls: ["wss://nos.lol", "wss://relay.primal.net"],
      sendToOpen: (payload) => {
        sent.push(payload);
      },
      subscribeToMessages: (next) => {
        handlers.push(next);
        return () => {
          const index = handlers.indexOf(next);
          if (index >= 0) handlers.splice(index, 1);
        };
      },
      timeoutMs: 1_000,
      now: () => now,
      createSubscriptionId: () => "obscur-rtt-test",
      sleep: (ms) => new Promise((resolve) => {
        globalThis.setTimeout(resolve, ms);
      }),
    });

    await Promise.resolve();
    expect(sent[0]).toContain("REQ");
    expect(sent[0]).toContain("obscur-rtt-test");
    const handler = handlers[0];
    expect(handler).toBeDefined();

    now = 1_042;
    handler!({ url: "wss://nos.lol", message: JSON.stringify(["EOSE", "obscur-rtt-test"]) });
    now = 1_055;
    handler!({ url: "wss://relay.primal.net", message: JSON.stringify(["EOSE", "obscur-rtt-test"]) });

    const results = await promise;
    expect(results).toEqual([
      { url: "wss://nos.lol", latencyMs: 42, ok: true },
      { url: "wss://relay.primal.net", latencyMs: 55, ok: true },
    ]);
    expect(sent.some((payload) => payload.includes("CLOSE"))).toBe(true);
  });

  it("marks missing EOSE as timeout without inventing latency", async () => {
    vi.useFakeTimers();
    const promise = runInPoolAppRttCycle({
      openUrls: ["wss://nos.lol", "ws://localhost:7000"],
      sendToOpen: () => {},
      subscribeToMessages: (next) => {
        queueMicrotask(() => {
          next({ url: "wss://nos.lol", message: JSON.stringify(["EOSE", "obscur-rtt-test"]) });
        });
        return () => {};
      },
      timeoutMs: 100,
      now: () => 5_000,
      createSubscriptionId: () => "obscur-rtt-test",
      sleep: (ms) => new Promise((resolve) => {
        globalThis.setTimeout(resolve, ms);
      }),
    });

    await vi.advanceTimersByTimeAsync(100);
    const results = await promise;
    expect(results.find((entry) => entry.url === "wss://nos.lol")?.ok).toBe(true);
    expect(results.find((entry) => entry.url === "ws://localhost:7000")).toEqual({
      url: "ws://localhost:7000",
      latencyMs: 0,
      ok: false,
      errorMessage: "eose timeout",
    });
  });

  it("returns empty when no open urls", async () => {
    const results = await runInPoolAppRttCycle({
      openUrls: [],
      sendToOpen: () => {},
      subscribeToMessages: () => () => {},
    });
    expect(results).toEqual([]);
  });
});

describe("resolveHandshakeProbeUrls", () => {
  it("excludes open pool members from second-socket handshake probes", () => {
    expect(resolveHandshakeProbeUrls({
      enabledUrls: ["wss://nos.lol", "wss://relay.primal.net", "ws://localhost:7000"],
      openUrls: ["wss://nos.lol", "ws://localhost:7000"],
    })).toEqual(["wss://relay.primal.net"]);
  });
});

describe("createInPoolRttSubscriptionId", () => {
  it("uses obscur-rtt prefix", () => {
    expect(createInPoolRttSubscriptionId().startsWith("obscur-rtt-")).toBe(true);
  });
});
