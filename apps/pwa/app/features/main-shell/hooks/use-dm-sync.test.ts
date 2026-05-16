import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { SetStateAction } from "react";
import type { Message, UnreadByConversationId } from "@/app/features/messaging/types";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { useDmSync } from "./use-dm-sync";

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: "m-1",
  kind: "user",
  content: "hello",
  timestamp: new Date("2026-03-15T00:00:00.000Z"),
  isOutgoing: false,
  status: "delivered",
  conversationId: "dm:peer-a",
  ...overrides,
});

describe("useDmSync", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not re-increment unread when the same message reloads after transient controller reset (instant settle)", () => {
    const emitNewMessageSpy = vi.spyOn(messageBus, "emitNewMessage");
    let unreadState: UnreadByConversationId = {};
    const setUnreadByConversationId = vi.fn((updater: SetStateAction<UnreadByConversationId>) => {
      unreadState = typeof updater === "function"
        ? (updater as (prev: UnreadByConversationId) => UnreadByConversationId)(unreadState)
        : updater;
    });

    const firstMessage = makeMessage();
    const secondMessage = makeMessage({ id: "m-2", content: "new" });

    const { rerender } = renderHook(
      ({ messages }) => useDmSync(messages, null, setUnreadByConversationId, true, true, {}, 0),
      { initialProps: { messages: [firstMessage] as ReadonlyArray<Message> } }
    );

    rerender({ messages: [] as ReadonlyArray<Message> });

    rerender({ messages: [firstMessage] as ReadonlyArray<Message> });
    expect(setUnreadByConversationId).not.toHaveBeenCalled();
    expect(emitNewMessageSpy).not.toHaveBeenCalled();

    rerender({ messages: [firstMessage, secondMessage] as ReadonlyArray<Message> });
    expect(setUnreadByConversationId).toHaveBeenCalledTimes(1);
    expect(unreadState["dm:peer-a"]).toBe(1);
    expect(emitNewMessageSpy).toHaveBeenCalledTimes(1);

    emitNewMessageSpy.mockRestore();
  });

  it("does not increment unread for incoming while that DM thread is focused", () => {
    const emitNewMessageSpy = vi.spyOn(messageBus, "emitNewMessage");
    let unreadState: UnreadByConversationId = {};
    const setUnreadByConversationId = vi.fn((updater: SetStateAction<UnreadByConversationId>) => {
      unreadState = typeof updater === "function"
        ? (updater as (prev: UnreadByConversationId) => UnreadByConversationId)(unreadState)
        : updater;
    });

    const cid = "dm:peer-a";
    const first = makeMessage({ id: "m-1", conversationId: cid });
    const second = makeMessage({ id: "m-2", conversationId: cid, content: "b" });

    const { rerender } = renderHook(
      ({ messages }) => useDmSync(messages, cid, setUnreadByConversationId, true, true, {}, 0),
      { initialProps: { messages: [first] as ReadonlyArray<Message> } },
    );

    rerender({ messages: [first, second] });
    expect(setUnreadByConversationId).not.toHaveBeenCalled();
    expect(emitNewMessageSpy).toHaveBeenCalledTimes(1);

    emitNewMessageSpy.mockRestore();
  });

  it("does not treat a second hydration batch as many unread when debounced settle is used", () => {
    vi.useFakeTimers();
    const emitNewMessageSpy = vi.spyOn(messageBus, "emitNewMessage");
    let unreadState: UnreadByConversationId = {};
    const setUnreadByConversationId = vi.fn((updater: SetStateAction<UnreadByConversationId>) => {
      unreadState = typeof updater === "function"
        ? (updater as (prev: UnreadByConversationId) => UnreadByConversationId)(unreadState)
        : updater;
    });

    const cid = "dm:peer-a";
    const batch1 = Array.from({ length: 50 }, (_, i) => makeMessage({
      id: `hist-${i}`,
      conversationId: cid,
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
    }));
    const batch2 = [
      ...batch1,
      ...Array.from({ length: 57 }, (_, i) => makeMessage({
        id: `hist-${50 + i}`,
        conversationId: cid,
        timestamp: new Date("2026-01-01T00:00:00.000Z"),
      })),
    ];

    const { rerender } = renderHook(
      ({ messages }) => useDmSync(messages, null, setUnreadByConversationId, true, true, {}, 400),
      { initialProps: { messages: batch1 as ReadonlyArray<Message> } },
    );

    rerender({ messages: batch2 });

    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(setUnreadByConversationId).not.toHaveBeenCalled();
    expect(emitNewMessageSpy).not.toHaveBeenCalled();

    const trulyNew = makeMessage({
      id: "live-1",
      conversationId: cid,
      content: "ping",
      timestamp: new Date("2026-06-01T12:00:00.000Z"),
    });
    rerender({ messages: [...batch2, trulyNew] });

    expect(setUnreadByConversationId).toHaveBeenCalledTimes(1);
    expect(unreadState[cid]).toBe(1);

    emitNewMessageSpy.mockRestore();
  });

  it("skips unread increment for incoming messages at or before last-viewed time", () => {
    const emitNewMessageSpy = vi.spyOn(messageBus, "emitNewMessage");
    let unreadState: UnreadByConversationId = {};
    const setUnreadByConversationId = vi.fn((updater: SetStateAction<UnreadByConversationId>) => {
      unreadState = typeof updater === "function"
        ? (updater as (prev: UnreadByConversationId) => UnreadByConversationId)(unreadState)
        : updater;
    });

    const cid = "dm:peer-a";
    const lastViewed = new Date("2026-06-15T18:00:00.000Z").getTime();
    const oldIncoming = makeMessage({
      id: "old-1",
      conversationId: cid,
      timestamp: new Date("2026-06-15T17:00:00.000Z"),
      eventCreatedAt: new Date("2026-06-15T17:00:00.000Z"),
    });

    const { rerender } = renderHook(
      ({ messages }) => useDmSync(
        messages,
        null,
        setUnreadByConversationId,
        true,
        true,
        { [cid]: lastViewed },
        0,
      ),
      { initialProps: { messages: [] as ReadonlyArray<Message> } },
    );

    rerender({ messages: [oldIncoming] });

    expect(setUnreadByConversationId).not.toHaveBeenCalled();
    expect(emitNewMessageSpy).toHaveBeenCalledTimes(1);

    emitNewMessageSpy.mockRestore();
  });

  it("emits message updated when network event id arrives after optimistic send", () => {
    const emitUpdatedSpy = vi.spyOn(messageBus, "emitMessageUpdated");
    const setUnreadByConversationId = vi.fn();

    const cid = "dm:peer-a";
    const optimistic = makeMessage({
      id: "local-1",
      conversationId: cid,
      isOutgoing: true,
      status: "sending",
    });
    const confirmed = makeMessage({
      ...optimistic,
      eventId: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      status: "delivered",
    });

    const { rerender } = renderHook(
      ({ messages }) => useDmSync(messages, cid, setUnreadByConversationId, true, true, {}, 0),
      { initialProps: { messages: [optimistic] as ReadonlyArray<Message> } },
    );

    rerender({ messages: [confirmed] });
    expect(emitUpdatedSpy).toHaveBeenCalledWith(cid, confirmed);

    emitUpdatedSpy.mockRestore();
  });
});
