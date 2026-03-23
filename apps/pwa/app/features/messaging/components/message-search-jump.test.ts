import { describe, expect, it } from "vitest";
import {
  resolveSearchJumpDomResolution,
  resolveSearchJumpStep,
} from "./message-search-jump";

const buildMessage = (params: Readonly<{ id: string; timestampMs: number; eventId?: string }>) => ({
  id: params.id,
  eventId: params.eventId,
  timestamp: new Date(params.timestampMs),
});

describe("message-search-jump", () => {
  it("resolves exact targets by id or eventId before fallback logic", () => {
    const messages = [
      buildMessage({ id: "m1", timestampMs: 1_000 }),
      buildMessage({ id: "m2", timestampMs: 2_000, eventId: "evt2" }),
    ];

    expect(resolveSearchJumpStep({
      messages,
      jumpToMessageId: "m1",
      jumpToMessageTimestampMs: null,
      loadAttemptCount: 0,
      maxLoadAttempts: 10,
    })).toEqual({
      kind: "found_by_id",
      targetMessageIndex: 0,
      resolvedMessageId: "m1",
    });

    expect(resolveSearchJumpStep({
      messages,
      jumpToMessageId: "evt2",
      jumpToMessageTimestampMs: null,
      loadAttemptCount: 0,
      maxLoadAttempts: 10,
    })).toEqual({
      kind: "found_by_id",
      targetMessageIndex: 1,
      resolvedMessageId: "m2",
    });
  });

  it("requests older history when timestamp target predates earliest loaded message", () => {
    const messages = [
      buildMessage({ id: "m10", timestampMs: 10_000 }),
      buildMessage({ id: "m11", timestampMs: 11_000 }),
    ];

    expect(resolveSearchJumpStep({
      messages,
      jumpToMessageId: "unknown",
      jumpToMessageTimestampMs: 9_000,
      loadAttemptCount: 0,
      maxLoadAttempts: 5,
    })).toEqual({ kind: "load_earlier_for_timestamp" });
  });

  it("falls back to timestamp index when id target is missing in current window", () => {
    const messages = [
      buildMessage({ id: "m10", timestampMs: 10_000 }),
      buildMessage({ id: "m20", timestampMs: 20_000 }),
      buildMessage({ id: "m30", timestampMs: 30_000 }),
    ];

    expect(resolveSearchJumpStep({
      messages,
      jumpToMessageId: "unknown",
      jumpToMessageTimestampMs: 21_000,
      loadAttemptCount: 1,
      maxLoadAttempts: 5,
    })).toEqual({
      kind: "timestamp_fallback",
      targetMessageIndex: 2,
      resolvedMessageId: "m30",
    });
  });

  it("returns unresolved reason after max attempts are exhausted", () => {
    const messages = [
      buildMessage({ id: "m1", timestampMs: 1_000 }),
    ];

    expect(resolveSearchJumpStep({
      messages,
      jumpToMessageId: "unknown",
      jumpToMessageTimestampMs: null,
      loadAttemptCount: 0,
      maxLoadAttempts: 0,
    })).toEqual({
      kind: "unresolved",
      reasonCode: "target_not_found_in_current_window",
    });

    expect(resolveSearchJumpStep({
      messages,
      jumpToMessageId: "unknown",
      jumpToMessageTimestampMs: null,
      loadAttemptCount: 5,
      maxLoadAttempts: 5,
    })).toEqual({
      kind: "unresolved",
      reasonCode: "target_not_found_after_load_attempts",
    });
  });

  it("classifies dom resolution as resolved, retry, or unresolved", () => {
    const element = document.createElement("div");

    expect(resolveSearchJumpDomResolution({
      targetElement: element,
      renderResolveAttemptCount: 0,
      maxRenderResolveAttempts: 20,
    })).toBe("resolved");

    expect(resolveSearchJumpDomResolution({
      targetElement: null,
      renderResolveAttemptCount: 5,
      maxRenderResolveAttempts: 20,
    })).toBe("retry");

    expect(resolveSearchJumpDomResolution({
      targetElement: null,
      renderResolveAttemptCount: 20,
      maxRenderResolveAttempts: 20,
    })).toBe("unresolved");
  });
});
