import { beforeEach, describe, expect, it } from "vitest";
import {
  clearMessageDeleteTombstones,
  isMessageDeleteSuppressed,
  loadSuppressedMessageDeleteIds,
  suppressMessageDeleteTombstone,
} from "./message-delete-tombstone-store";

describe("message-delete-tombstone-store", () => {
  beforeEach(() => {
    clearMessageDeleteTombstones();
  });

  it("persists suppressed message ids", () => {
    expect(isMessageDeleteSuppressed("m-1")).toBe(false);
    suppressMessageDeleteTombstone("m-1", 1_000);
    expect(isMessageDeleteSuppressed("m-1", 1_001)).toBe(true);
    expect(loadSuppressedMessageDeleteIds(1_001).has("m-1")).toBe(true);
  });

  it("ignores invalid ids", () => {
    suppressMessageDeleteTombstone("");
    suppressMessageDeleteTombstone("   ");
    expect(loadSuppressedMessageDeleteIds().size).toBe(0);
  });
});

