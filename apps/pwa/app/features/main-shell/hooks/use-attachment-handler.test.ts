import { describe, expect, it } from "vitest";
import { useAttachmentHandlerInternals } from "./use-attachment-handler";

describe("useAttachmentHandler internals", () => {
  it("clamps progress to a bounded integer range", () => {
    expect(useAttachmentHandlerInternals.clampProgress(-12)).toBe(0);
    expect(useAttachmentHandlerInternals.clampProgress(42.6)).toBe(43);
    expect(useAttachmentHandlerInternals.clampProgress(140)).toBe(100);
    expect(useAttachmentHandlerInternals.clampProgress(Number.NaN)).toBe(0);
  });

  it("uses larger fallback steps early, then slows near completion", () => {
    expect(useAttachmentHandlerInternals.computeFallbackTickStep(10)).toBe(3);
    expect(useAttachmentHandlerInternals.computeFallbackTickStep(52)).toBe(2);
    expect(useAttachmentHandlerInternals.computeFallbackTickStep(86)).toBe(1);
  });

  it("maps per-file local progress into overall multi-file progress", () => {
    expect(useAttachmentHandlerInternals.createPerFileProgress({
      fileIndex: 0,
      fileCount: 1,
      fileLocalProgressPercent: 0,
    })).toBe(0);

    expect(useAttachmentHandlerInternals.createPerFileProgress({
      fileIndex: 0,
      fileCount: 2,
      fileLocalProgressPercent: 50,
    })).toBe(25);

    expect(useAttachmentHandlerInternals.createPerFileProgress({
      fileIndex: 1,
      fileCount: 2,
      fileLocalProgressPercent: 100,
    })).toBe(100);
  });
});

