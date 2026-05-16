import { describe, expect, it } from "vitest";
import {
  MESSAGE_DELETE_TOMBSTONE_RETENTION_MS,
  MESSAGE_DELETE_TOMBSTONE_STORAGE_KEY,
  mergeMessageDeleteTombstoneStates,
  normalizeMessageDeleteTombstoneState,
} from "@dweb/storage-contracts/message-delete-tombstones";

/**
 * Regression anchor for v1.5.0 tombstone storage: changing merge/normalize semantics
 * or the storage key breaks PWA localStorage + IndexedDB + native merge paths.
 */
describe("message-delete tombstones contract (no regression)", () => {
  it("keeps stable localStorage scope key prefix", () => {
    expect(MESSAGE_DELETE_TOMBSTONE_STORAGE_KEY).toBe("obscur.messaging.message_delete_tombstones.v1");
  });

  it("mergeMessageDeleteTombstoneStates keeps later deletedAtUnixMs per id", () => {
    const nowMs = MESSAGE_DELETE_TOMBSTONE_RETENTION_MS + 100;
    const a = { entries: [{ id: "m1", deletedAtUnixMs: 100 }] };
    const b = { entries: [{ id: "m1", deletedAtUnixMs: 200 }] };
    const merged = mergeMessageDeleteTombstoneStates(a, b, nowMs);
    expect(merged.entries.find((e) => e.id === "m1")?.deletedAtUnixMs).toBe(200);

    const mergedReverse = mergeMessageDeleteTombstoneStates(b, a, nowMs);
    expect(mergedReverse.entries.find((e) => e.id === "m1")?.deletedAtUnixMs).toBe(200);
  });

  it("normalizeMessageDeleteTombstoneState dedupes same id to max deletedAt", () => {
    const nowMs = MESSAGE_DELETE_TOMBSTONE_RETENTION_MS + 10;
    const state = {
      entries: [
        { id: "x", deletedAtUnixMs: 50 },
        { id: "x", deletedAtUnixMs: 99 },
        { id: "x", deletedAtUnixMs: 10 },
      ],
    };
    const out = normalizeMessageDeleteTombstoneState(state, nowMs);
    expect(out.entries.filter((e) => e.id === "x")).toEqual([{ id: "x", deletedAtUnixMs: 99 }]);
  });
});
