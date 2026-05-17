import { describe, expect, it, vi } from "vitest";
import {
  runStandbyRelayProbeCycle,
  STANDBY_PROBE_INTER_URL_GAP_MS,
  sleep,
} from "./relay-standby-probe-schedule";

describe("relay-standby-probe-schedule", () => {
  it("probes urls sequentially with gaps", async () => {
    vi.useFakeTimers();
    const probe = vi.fn(async (url: string) => ({
      url,
      latencyMs: 10,
      ok: true,
    }));

    const promise = runStandbyRelayProbeCycle({
      urls: ["wss://a", "wss://b"],
      probe,
      gapMs: 100,
    });

    await vi.runAllTimersAsync();
    const results = await promise;

    expect(probe).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
    vi.useRealTimers();
  });

  it("stops mid-cycle when document is hidden", async () => {
    const probe = vi.fn(async (url: string) => ({
      url,
      latencyMs: 1,
      ok: true,
    }));
    let visible = true;

    const results = await runStandbyRelayProbeCycle({
      urls: ["wss://a", "wss://b", "wss://c"],
      probe,
      gapMs: 0,
      isVisible: () => visible,
    });

    expect(results).toHaveLength(3);

    visible = false;
    const stopped = await runStandbyRelayProbeCycle({
      urls: ["wss://a", "wss://b", "wss://c"],
      probe,
      gapMs: 0,
      isVisible: () => visible,
    });

    expect(stopped).toHaveLength(0);
  });

  it("sleep resolves after delay", async () => {
    vi.useFakeTimers();
    const promise = sleep(50);
    await vi.advanceTimersByTimeAsync(49);
    let settled = false;
    void promise.then(() => {
      settled = true;
    });
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(settled).toBe(true);
    vi.useRealTimers();
  });

  it("exports a positive inter-url gap", () => {
    expect(STANDBY_PROBE_INTER_URL_GAP_MS).toBeGreaterThan(0);
  });
});
