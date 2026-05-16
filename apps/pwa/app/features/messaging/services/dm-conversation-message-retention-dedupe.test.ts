import { describe, expect, it } from "vitest";
import type { Message } from "../types";
import { filterMessagesByLocalRetention, dedupeMessagesByIdentity } from "./dm-conversation-message-retention-dedupe";

const createMessage = (params: Readonly<{ id: string; timestampMs: number; content?: string; eventId?: string }>): Message => ({
  id: params.id,
  kind: "user",
  content: params.content ?? params.id,
  timestamp: new Date(params.timestampMs),
  isOutgoing: false,
  status: "delivered",
  ...(params.eventId ? { eventId: params.eventId } : {}),
});

describe("filterMessagesByLocalRetention", () => {
  it("keeps all messages when retention is disabled", () => {
    const messages = [
      createMessage({ id: "m1", timestampMs: 1_000 }),
      createMessage({ id: "m2", timestampMs: 2_000 }),
    ];
    expect(filterMessagesByLocalRetention(messages, 0, 10_000)).toHaveLength(2);
  });

  it("drops messages older than the configured retention window", () => {
    const nowMs = 100 * 24 * 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;
    const messages = [
      createMessage({ id: "old", timestampMs: nowMs - (31 * dayMs) }),
      createMessage({ id: "edge", timestampMs: nowMs - (30 * dayMs) }),
      createMessage({ id: "new", timestampMs: nowMs - (2 * dayMs) }),
    ];
    const filtered = filterMessagesByLocalRetention(messages, 30, nowMs);
    expect(filtered.map((message) => message.id)).toEqual(["edge", "new"]);
  });
});

describe("dedupeMessagesByIdentity", () => {
  it("keeps newer timestamp for same eventId", () => {
    const older = createMessage({ id: "a", timestampMs: 100, eventId: "ev1" });
    const newer = createMessage({ id: "b", timestampMs: 200, eventId: "ev1" });
    const out = dedupeMessagesByIdentity([older, newer]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("b");
  });
});
