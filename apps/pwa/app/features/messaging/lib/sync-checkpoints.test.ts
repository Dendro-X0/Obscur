import { beforeEach, describe, expect, it } from "vitest";
import {
  createBackfillRequest,
  detectSyncGap,
  getTimelineCheckpoint,
  resetTimelineCheckpointsForTests,
  updateTimelineCheckpoint,
} from "./sync-checkpoints";

describe("sync-checkpoints", () => {
  beforeEach(() => {
    resetTimelineCheckpointsForTests();
  });

  it("stores and returns timeline checkpoints", () => {
    const key = "dm:test";
    const now = Math.floor(Date.now() / 1000);
    updateTimelineCheckpoint(key, now);
    const checkpoint = getTimelineCheckpoint(key);
    expect(checkpoint).toBeTruthy();
    expect(checkpoint?.timelineKey).toBe(key);
    expect(checkpoint?.lastProcessedAtUnixSeconds).toBe(now);
  });

  it("detects large sync gaps and produces backfill request", () => {
    const key = "dm:gap";
    const now = Math.floor(Date.now() / 1000);
    updateTimelineCheckpoint(key, now);
    const gap = detectSyncGap(key, now - (7 * 60 * 60));
    expect(gap).toBeTruthy();
    const backfill = createBackfillRequest(key, now - (7 * 60 * 60), gap!);
    expect(backfill.reason).toBe("gap_detected");
    expect(backfill.limit).toBe(250);
    expect(backfill.sinceUnixSeconds).toBe(now - (2 * 60 * 60));
  });
});
