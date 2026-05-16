import { describe, expect, it } from "vitest";
import type { Message } from "../types";
import {
  capMessageListToSoftLiveWindow,
  filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlayMessages,
  mergeProjectionFirstWithOverlayMessages,
  selectMessagesForConversationHistoryAuthority,
} from "./conversation-message-materialization";

const mk = (params: Readonly<{
  id: string;
  eventId?: string | null;
  conversationId?: string;
}>): Message => ({
  id: params.id,
  kind: "user",
  content: "x",
  timestamp: new Date(0),
  isOutgoing: false,
  status: "delivered",
  eventId: params.eventId ?? undefined,
  conversationId: params.conversationId ?? "dm:a:b",
});

describe("conversation-message-materialization", () => {
  it("mergeProjectionFirstWithOverlayMessages skips overlay when eventId maps to different id", () => {
    const projection = [mk({ id: "nostr-1", eventId: "nostr-1", conversationId: "dm:x" })];
    const overlay = [mk({ id: "uuid-2", eventId: "nostr-1", conversationId: "dm:x" })];
    const merged = mergeProjectionFirstWithOverlayMessages(
      projection,
      overlay,
      () => true,
    );
    expect(merged.map((m) => m.id)).toEqual(["nostr-1"]);
  });

  it("mergeProjectionFirstWithOverlayMessages lets overlay refresh same id", () => {
    const projection = [mk({ id: "a", eventId: "e1", conversationId: "dm:x" })];
    const refreshed: Message = { ...mk({ id: "a", eventId: "e1", conversationId: "dm:x" }), content: "updated" };
    const merged = mergeProjectionFirstWithOverlayMessages(projection, [refreshed], () => true);
    expect(merged[0]?.content).toBe("updated");
  });

  it("mergeHydratedBaseWithLiveOverlayMessages does not overwrite base id", () => {
    const base = [mk({ id: "db-1", eventId: "ev-1", conversationId: "dm:x" })];
    const liveRow: Message = { ...mk({ id: "db-1", eventId: "ev-1", conversationId: "dm:x" }), content: "live" };
    const merged = mergeHydratedBaseWithLiveOverlayMessages(base, [liveRow], new Set(["dm:x"]));
    expect(merged).toHaveLength(1);
    expect(merged[0]?.content).toBe("x");
  });

  it("mergeHydratedBaseWithLiveOverlayMessages adds optimistic row when eventId not in base", () => {
    const base = [mk({ id: "db-1", eventId: "ev-1", conversationId: "dm:x" })];
    const live = [mk({ id: "uuid-1", eventId: "ev-2", conversationId: "dm:x" })];
    const merged = mergeHydratedBaseWithLiveOverlayMessages(base, live, new Set(["dm:x"]));
    expect(merged.map((m) => m.id).sort()).toEqual(["db-1", "uuid-1"]);
  });

  it("mergeHydratedBaseWithLiveOverlayMessages skips live when eventId already on base", () => {
    const base = [mk({ id: "db-1", eventId: "ev-1", conversationId: "dm:x" })];
    const live = [mk({ id: "uuid-1", eventId: "ev-1", conversationId: "dm:x" })];
    const merged = mergeHydratedBaseWithLiveOverlayMessages(base, live, new Set(["dm:x"]));
    expect(merged.map((m) => m.id)).toEqual(["db-1"]);
  });

  it("filterMessagesBySuppressedIds removes by id or eventId", () => {
    const suppressed = new Set(["ev-1"]);
    const list = [mk({ id: "a", eventId: "ev-1" }), mk({ id: "b", eventId: "ev-2" })];
    expect(filterMessagesBySuppressedIds(list, suppressed).map((m) => m.id)).toEqual(["b"]);
  });

  it("filterMessagesBySuppressedIds removes when any alias matches suppression set", () => {
    const suppressed = new Set(["local-uuid"]);
    const list = [mk({ id: "local-uuid", eventId: "nostr-event" })];
    expect(filterMessagesBySuppressedIds(list, suppressed)).toEqual([]);
  });

  it("selectMessagesForConversationHistoryAuthority picks one layer", () => {
    const layers = {
      projection: [mk({ id: "p1" })],
      persisted: [mk({ id: "s1" })],
      indexed: [mk({ id: "i1" })],
    };
    expect(
      selectMessagesForConversationHistoryAuthority(
        { authority: "projection", reason: "projection_read_cutover" },
        layers,
      ).map((m) => m.id),
    ).toEqual(["p1"]);
    expect(
      selectMessagesForConversationHistoryAuthority(
        { authority: "persisted", reason: "persisted_recovery_indexed_empty" },
        layers,
      ).map((m) => m.id),
    ).toEqual(["s1"]);
    expect(
      selectMessagesForConversationHistoryAuthority(
        { authority: "indexed", reason: "indexed_primary" },
        layers,
      ).map((m) => m.id),
    ).toEqual(["i1"]);
  });

  it("capMessageListToSoftLiveWindow keeps tail when over limit", () => {
    const list = [mk({ id: "a" }), mk({ id: "b" }), mk({ id: "c" })];
    expect(capMessageListToSoftLiveWindow(list, 2).map((m) => m.id)).toEqual(["b", "c"]);
    expect(capMessageListToSoftLiveWindow(list, 3)).toBe(list);
    expect(capMessageListToSoftLiveWindow(list, 0)).toBe(list);
  });
});
