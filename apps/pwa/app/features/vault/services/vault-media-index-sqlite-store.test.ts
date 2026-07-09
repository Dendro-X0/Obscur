import { describe, expect, it } from "vitest";
import {
  mapLocalMediaIndexEntryToRecord,
  mapVaultMediaIndexRecordToEntry,
} from "./vault-media-index-sqlite-store";
import type { LocalMediaIndexEntry } from "./vault-media-index-contract";

describe("vault-media-index-sqlite-store mapping", () => {
  it("roundtrips local index entries through sqlite records", () => {
    const entry: LocalMediaIndexEntry = {
      remoteUrl: "obscur://vault/local/abc123",
      relativePath: "vault-media/bf2f9ab5d641772b682a1df5.obscurvault",
      savedAtUnixMs: 1_700_000_000_000,
      fileName: "storm-photo.jpg",
      contentType: "image/jpeg",
      size: 2048,
      messageEventId: "evt-1",
      explicitChatSave: true,
    };
    const record = mapLocalMediaIndexEntryToRecord(entry.remoteUrl, entry, "default");
    expect(record.profile_id).toBe("default");
    expect(record.message_event_id).toBe("evt-1");
    expect(record.explicit_chat_save).toBe(true);
    const restored = mapVaultMediaIndexRecordToEntry(record);
    expect(restored).toEqual(entry);
  });
});
