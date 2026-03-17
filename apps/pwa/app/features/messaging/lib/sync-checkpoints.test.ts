import { beforeEach, describe, expect, it } from "vitest";
import {
  createBackfillRequest,
  detectSyncGap,
  getTimelineCheckpoint,
  repairTimelineCheckpoint,
  resetTimelineCheckpointsForTests,
  syncCheckpointInternals,
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

  it("persists checkpoints to scoped storage", () => {
    const key = "dm:persisted";
    const now = Math.floor(Date.now() / 1000);

    updateTimelineCheckpoint(key, now);

    const raw = localStorage.getItem(syncCheckpointInternals.getStorageKey());
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
    expect(parsed.checkpoints).toEqual([
      expect.objectContaining({
        timelineKey: key,
        lastProcessedAtUnixSeconds: now,
      }),
    ]);
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

  it("repairs checkpoints that are accidentally in the future", () => {
    const key = "dm:repair-future";
    const now = Math.floor(Date.now() / 1000);
    updateTimelineCheckpoint(key, now + (10 * 60));
    const report = repairTimelineCheckpoint(key, now - 100);
    expect(report.result).toBe("repaired");
    const checkpoint = getTimelineCheckpoint(key);
    expect(checkpoint?.lastProcessedAtUnixSeconds).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it("returns ok for already valid checkpoints", () => {
    const key = "dm:repair-ok";
    const now = Math.floor(Date.now() / 1000);
    updateTimelineCheckpoint(key, now - 30);
    const report = repairTimelineCheckpoint(key, now - 60);
    expect(report.result).toBe("ok");
    expect(report.repairedSinceUnixSeconds).toBe(now - 60);
  });

  it("repairs negative checkpoints without silently preserving invalid values", () => {
    const key = "dm:repair-negative";
    updateTimelineCheckpoint(key, -25);
    const report = repairTimelineCheckpoint(key, 0);

    expect(report.result).toBe("repaired");
    expect(report.repairedSinceUnixSeconds).toBe(0);
    expect(getTimelineCheckpoint(key)?.lastProcessedAtUnixSeconds).toBe(0);
  });

  it("does not report a sync gap when no checkpoint evidence exists", () => {
    const gap = detectSyncGap("dm:missing", Math.floor(Date.now() / 1000) - 3600);
    expect(gap).toBeNull();
  });

  it("loads persisted checkpoints after memory reset", () => {
    const key = "dm:reload";
    const now = Math.floor(Date.now() / 1000);
    syncCheckpointInternals.persistCheckpointState(new Map([
      [key, {
        timelineKey: key,
        lastProcessedAtUnixSeconds: now,
        updatedAtUnixMs: Date.now(),
      }],
    ]));

    const root = globalThis as Record<string, unknown>;
    root.__obscur_sync_checkpoints__ = undefined;

    expect(getTimelineCheckpoint(key)).toEqual(
      expect.objectContaining({
        timelineKey: key,
        lastProcessedAtUnixSeconds: now,
      })
    );
  });
});
