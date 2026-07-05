import { afterEach, describe, expect, it, vi } from "vitest";
import { probeStandbyRelayLatency } from "./standby-latency-prober";

type WsHandlers = {
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  close: () => void;
};

const makeWsFake = (): WsHandlers => ({
  onopen: null,
  onmessage: null,
  onerror: null,
  onclose: null,
  close: vi.fn(),
});

const fakeEvent = {} as Event;
const fakeMessageEvent = {} as MessageEvent;

describe("probeStandbyRelayLatency", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with latency when a message frame arrives", async () => {
    vi.useFakeTimers();
    const factory = (): WebSocket => {
      const ws = makeWsFake();
      setTimeout(() => {
        ws.onopen?.(fakeEvent);
        ws.onmessage?.(fakeMessageEvent);
      }, 5);
      return ws as unknown as WebSocket;
    };

    const promise = probeStandbyRelayLatency("wss://relay.test", 2000, factory);
    await vi.advanceTimersByTimeAsync(5);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBe(5);
  });

  it("resolves ok=true after frame-timeout (open but no frame)", async () => {
    vi.useFakeTimers();
    const frameTimeoutMs = 50;
    const factory = (): WebSocket => {
      const ws = makeWsFake();
      setTimeout(() => { ws.onopen?.(fakeEvent); }, 5);
      return ws as unknown as WebSocket;
    };

    const promise = probeStandbyRelayLatency("wss://relay.test", frameTimeoutMs, factory);
    await vi.advanceTimersByTimeAsync(5);
    await vi.advanceTimersByTimeAsync(frameTimeoutMs);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBe(frameTimeoutMs);
  });

  it("resolves ok=false when socket errors", async () => {
    vi.useFakeTimers();
    const factory = (): WebSocket => {
      const ws = makeWsFake();
      setTimeout(() => { ws.onerror?.(fakeEvent); }, 5);
      return ws as unknown as WebSocket;
    };

    const promise = probeStandbyRelayLatency("wss://relay.test", 2000, factory);
    await vi.advanceTimersByTimeAsync(5);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.latencyMs).toBe(0);
  });

  it("resolves ok=false when socket closes before frame", async () => {
    vi.useFakeTimers();
    const factory = (): WebSocket => {
      const ws = makeWsFake();
      setTimeout(() => {
        ws.onopen?.(fakeEvent);
        ws.onclose?.({ reason: "server closed" } as CloseEvent);
      }, 5);
      return ws as unknown as WebSocket;
    };

    const promise = probeStandbyRelayLatency("wss://relay.test", 2000, factory);
    await vi.advanceTimersByTimeAsync(5);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("server closed");
  });

  it("resolves ok=false when factory throws", async () => {
    const factory = (): WebSocket => {
      throw new Error("invalid url");
    };

    const result = await probeStandbyRelayLatency("bad-url", 2000, factory);
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("invalid url");
  });
});
