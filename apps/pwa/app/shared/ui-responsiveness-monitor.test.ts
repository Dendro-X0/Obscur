import { describe, expect, it } from "vitest";
import {
  applyFrameGapSample,
  applyLongTaskSample,
  createUiResponsivenessSnapshot,
} from "./ui-responsiveness-monitor";

describe("ui-responsiveness-monitor", () => {
  it("tracks dropped frames and lag spikes when frame gap exceeds thresholds", () => {
    const base = createUiResponsivenessSnapshot(1_000);
    const unchanged = applyFrameGapSample(base, 24, 2_000);
    expect(unchanged).toBe(base);

    const dropped = applyFrameGapSample(base, 80, 3_000);
    expect(dropped.droppedFrameCount).toBe(1);
    expect(dropped.frameLagSpikeCount).toBe(0);
    expect(dropped.worstFrameGapMs).toBe(80);
    expect(dropped.lastFrameLagAtUnixMs).toBe(3_000);

    const spiked = applyFrameGapSample(dropped, 150, 4_000);
    expect(spiked.droppedFrameCount).toBe(2);
    expect(spiked.frameLagSpikeCount).toBe(1);
    expect(spiked.worstFrameGapMs).toBe(150);
    expect(spiked.lastFrameLagAtUnixMs).toBe(4_000);
  });

  it("aggregates long-task counters and durations", () => {
    const base = createUiResponsivenessSnapshot(1_000);
    const first = applyLongTaskSample(base, 45, 2_000);
    const second = applyLongTaskSample(first, 120, 3_000);

    expect(second.longTaskCount).toBe(2);
    expect(second.longTaskTotalDurationMs).toBe(165);
    expect(second.longTaskWorstDurationMs).toBe(120);
    expect(second.lastLongTaskAtUnixMs).toBe(3_000);
  });
});
