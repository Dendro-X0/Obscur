import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import {
  clearMessageDeleteTombstones,
  isMessageDeleteSuppressed,
  loadMessageDeleteTombstoneEntries,
  loadSuppressedMessageDeleteIds,
  replaceMessageDeleteTombstones,
  suppressMessageDeleteTombstone,
} from "./message-delete-tombstone-store";

vi.mock("@/app/shared/account-sync-mutation-signal", () => ({
  emitAccountSyncMutation: vi.fn(),
}));

describe("message-delete-tombstone-store", () => {
  beforeEach(() => {
    clearMessageDeleteTombstones();
    vi.mocked(emitAccountSyncMutation).mockClear();
  });

  it("persists suppressed message ids", () => {
    expect(isMessageDeleteSuppressed("m-1")).toBe(false);
    suppressMessageDeleteTombstone("m-1", 1_000);
    expect(isMessageDeleteSuppressed("m-1", 1_001)).toBe(true);
    expect(loadSuppressedMessageDeleteIds(1_001).has("m-1")).toBe(true);
    expect(emitAccountSyncMutation).toHaveBeenCalledWith("message_delete_tombstones_changed");
  });

  it("ignores invalid ids", () => {
    suppressMessageDeleteTombstone("");
    suppressMessageDeleteTombstone("   ");
    expect(loadSuppressedMessageDeleteIds().size).toBe(0);
  });

  it("replaces tombstones with normalized latest entries", () => {
    replaceMessageDeleteTombstones([
      { id: " legacy-id ", deletedAtUnixMs: 1_000 },
      { id: "legacy-id", deletedAtUnixMs: 2_000 },
      { id: "stale-id", deletedAtUnixMs: -1 },
    ], 2_000);

    expect(loadMessageDeleteTombstoneEntries(2_001)).toEqual([
      { id: "legacy-id", deletedAtUnixMs: 2_000 },
    ]);
    expect(emitAccountSyncMutation).toHaveBeenCalledWith("message_delete_tombstones_changed");
  });
});
