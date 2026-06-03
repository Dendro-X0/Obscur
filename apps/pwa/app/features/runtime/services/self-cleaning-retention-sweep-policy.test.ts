import { describe, expect, it } from "vitest";
import {
  LOCAL_MEDIA_INDEX_MAX_ENTRIES,
  LOCAL_MEDIA_INDEX_RETENTION_MS,
  pruneLocalMediaIndexRetentionEntries,
  summarizeTombstoneRetentionSweep,
} from "./self-cleaning-retention-sweep-policy";

describe("self-cleaning-retention-sweep-policy", () => {
  describe("pruneLocalMediaIndexRetentionEntries", () => {
    it("removes entries older than retention window", () => {
      const nowMs = 1_700_000_000_000;
      const result = pruneLocalMediaIndexRetentionEntries(
        [
          { remoteUrl: "https://a.example/old", savedAtUnixMs: nowMs - LOCAL_MEDIA_INDEX_RETENTION_MS - 1 },
          { remoteUrl: "https://a.example/fresh", savedAtUnixMs: nowMs - 1_000 },
        ],
        nowMs,
      );
      expect(result.removedByAge).toBe(1);
      expect(result.removedByCap).toBe(0);
      expect(result.keptRemoteUrls).toEqual(["https://a.example/fresh"]);
    });

    it("caps remaining entries by max count keeping newest", () => {
      const nowMs = 1_700_000_000_000;
      const entries = Array.from({ length: LOCAL_MEDIA_INDEX_MAX_ENTRIES + 5 }, (_, index) => ({
        remoteUrl: `https://a.example/${index}`,
        savedAtUnixMs: nowMs - (LOCAL_MEDIA_INDEX_MAX_ENTRIES + 5 - index) * 1_000,
      }));
      const result = pruneLocalMediaIndexRetentionEntries(entries, nowMs);
      expect(result.removedByAge).toBe(0);
      expect(result.removedByCap).toBe(5);
      expect(result.keptRemoteUrls).toHaveLength(LOCAL_MEDIA_INDEX_MAX_ENTRIES);
      expect(result.keptRemoteUrls[0]).toBe("https://a.example/5");
      expect(result.keptRemoteUrls.at(-1)).toBe(`https://a.example/${LOCAL_MEDIA_INDEX_MAX_ENTRIES + 4}`);
    });

    it("drops entries with invalid timestamps", () => {
      const nowMs = 1_700_000_000_000;
      const result = pruneLocalMediaIndexRetentionEntries(
        [{ remoteUrl: "https://a.example/bad", savedAtUnixMs: Number.NaN }],
        nowMs,
      );
      expect(result.removedByAge).toBe(1);
      expect(result.keptRemoteUrls).toEqual([]);
    });
  });

  describe("summarizeTombstoneRetentionSweep", () => {
    it("computes removed and remaining counts", () => {
      expect(summarizeTombstoneRetentionSweep(12, 7)).toEqual({
        removedCount: 5,
        remainingCount: 7,
      });
    });
  });
});
