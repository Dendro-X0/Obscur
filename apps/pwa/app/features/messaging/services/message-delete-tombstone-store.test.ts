import { beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGE_DELETE_TOMBSTONE_RETENTION_MS } from "@dweb/storage-contracts/message-delete-tombstones";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import {
  clearMessageDeleteTombstones,
  isMessageDeleteSuppressed,
  loadMessageDeleteTombstoneEntries,
  liftMessageDeleteSuppression,
  loadSuppressedMessageDeleteIds,
  replaceMessageDeleteTombstones,
  sweepMessageDeleteTombstones,
  suppressMessageDeleteTombstone,
  messageDeleteTombstoneStoreInternals,
} from "./message-delete-tombstone-store";

vi.mock("@dweb/db", () => ({
  isTauri: () => false,
  dbGetTombstones: vi.fn(async () => []),
  dbInsertTombstone: vi.fn(async () => undefined),
  dbDeleteAllTombstonesForProfile: vi.fn(async () => undefined),
}));

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

  it("replaces tombstones with normalized latest entries", async () => {
    await replaceMessageDeleteTombstones([
      { id: " legacy-id ", deletedAtUnixMs: 1_000 },
      { id: "legacy-id", deletedAtUnixMs: 2_000 },
      { id: "stale-id", deletedAtUnixMs: -1 },
    ], 2_000);

    expect(loadMessageDeleteTombstoneEntries(2_001)).toEqual([
      { id: "legacy-id", deletedAtUnixMs: 2_000 },
    ]);
    expect(emitAccountSyncMutation).toHaveBeenCalledWith("message_delete_tombstones_changed");
  });

  it("merges backup tombstones with locally-written tombstones so restore cannot resurrect deleted messages", async () => {
    // Simulate: user deleted "local-only-id" locally after the last backup was taken.
    suppressMessageDeleteTombstone("local-only-id", 3_000);

    // Simulate: restore arrives with a backup that predates the local delete.
    await replaceMessageDeleteTombstones([
      { id: "backup-id", deletedAtUnixMs: 1_000 },
    ], 3_001);

    const ids = loadSuppressedMessageDeleteIds(3_001);
    expect(ids.has("local-only-id")).toBe(true);
    expect(ids.has("backup-id")).toBe(true);
  });

  it("liftMessageDeleteSuppression removes ids for show-again", () => {
    const nowMs = Date.now();
    suppressMessageDeleteTombstone("m-hide", nowMs);
    suppressMessageDeleteTombstone("m-keep-hidden", nowMs);
    expect(isMessageDeleteSuppressed("m-hide", nowMs + 1)).toBe(true);

    liftMessageDeleteSuppression(["m-hide"]);
    expect(isMessageDeleteSuppressed("m-hide", nowMs + 1)).toBe(false);
    expect(isMessageDeleteSuppressed("m-keep-hidden", nowMs + 1)).toBe(true);
    expect(emitAccountSyncMutation).toHaveBeenCalledWith("message_delete_tombstones_changed");
  });

  it("keeps the most recent deletedAtUnixMs when both backup and local have an entry for the same id", async () => {
    suppressMessageDeleteTombstone("shared-id", 5_000);

    // Backup has an older timestamp for the same id.
    await replaceMessageDeleteTombstones([
      { id: "shared-id", deletedAtUnixMs: 2_000 },
    ], 5_001);

    const entries = loadMessageDeleteTombstoneEntries(5_001);
    const entry = entries.find((e) => e.id === "shared-id");
    expect(entry?.deletedAtUnixMs).toBe(5_000);
  });

  it("sweepMessageDeleteTombstones removes expired tombstones", () => {
    const nowMs = 10_000_000_000;
    messageDeleteTombstoneStoreInternals.writeState({
      entries: [
        { id: "fresh-id", deletedAtUnixMs: nowMs - 1_000 },
        { id: "stale-id", deletedAtUnixMs: nowMs - MESSAGE_DELETE_TOMBSTONE_RETENTION_MS - 1 },
      ],
    });
    vi.mocked(emitAccountSyncMutation).mockClear();

    const result = sweepMessageDeleteTombstones(undefined, nowMs);

    expect(result.removedCount).toBe(1);
    expect(result.remainingCount).toBe(1);
    expect(isMessageDeleteSuppressed("fresh-id", nowMs)).toBe(true);
    expect(isMessageDeleteSuppressed("stale-id", nowMs)).toBe(false);
    expect(emitAccountSyncMutation).toHaveBeenCalledWith("message_delete_tombstones_changed");
  });
});
