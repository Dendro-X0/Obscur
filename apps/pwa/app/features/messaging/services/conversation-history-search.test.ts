import { describe, expect, it } from "vitest";
import type { Message } from "@/app/features/messaging/types";
import {
  mergeConversationHistorySearchResults,
  resolveHistorySearchResultsForLiveMessages,
  searchLiveConversationMessages,
} from "./conversation-history-search";

const createLiveMessage = (params: Readonly<{
  id: string;
  content: string;
  timestampMs: number;
}>): Message => ({
  id: params.id,
  kind: "user",
  content: params.content,
  timestamp: new Date(params.timestampMs),
  isOutgoing: true,
  status: "delivered",
});

describe("conversation-history-search", () => {
  it("finds matches in live conversation messages not yet in chat state store", () => {
    const hits = searchLiveConversationMessages([
      createLiveMessage({ id: "m-1", content: "hello test world", timestampMs: 1_000 }),
      createLiveMessage({ id: "m-2", content: "other", timestampMs: 2_000 }),
      createLiveMessage({ id: "m-3", content: "second test", timestampMs: 3_000 }),
    ], "test", 50);

    expect(hits.map((hit) => hit.messageId)).toEqual(["m-3", "m-1"]);
    expect(hits[0]?.preview).toBe("second test");
  });

  it("dedupes store and live hits and prefers live ids when timestamps align", () => {
    const merged = mergeConversationHistorySearchResults(
      [{ messageId: "evt-1", timestampMs: 1_000, preview: "alpha", resultKind: "text", voiceDurationLabel: null }],
      [
        { messageId: "rumor-1", timestampMs: 1_000, preview: "alpha", resultKind: "text", voiceDurationLabel: null },
        { messageId: "m-2", timestampMs: 5_000, preview: "beta", resultKind: "text", voiceDurationLabel: null },
      ],
      10,
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]?.messageId).toBe("m-2");
    expect(merged[1]?.messageId).toBe("rumor-1");
  });

  it("rewrites persisted search ids to live message ids", () => {
    const liveMessages: ReadonlyArray<Message> = [{
      id: "rumor-9",
      kind: "user",
      content: "test",
      timestamp: new Date(4_000),
      isOutgoing: true,
      status: "delivered",
      eventId: "evt-9",
    }];

    const resolved = resolveHistorySearchResultsForLiveMessages(
      [{ messageId: "evt-9", timestampMs: 4_000, preview: "test", resultKind: "text", voiceDurationLabel: null }],
      liveMessages,
    );

    expect(resolved[0]?.messageId).toBe("rumor-9");
  });
});
