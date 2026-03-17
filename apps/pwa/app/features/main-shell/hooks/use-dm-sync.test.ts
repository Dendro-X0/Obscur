import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  it("does not re-increment unread when the same message reloads after transient controller reset", () => {
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
      ({ messages }) => useDmSync(messages, null, setUnreadByConversationId, true),
      { initialProps: { messages: [firstMessage] as ReadonlyArray<Message> } }
    );

    // Simulate runtime/controller reset where message list is briefly emptied.
    rerender({ messages: [] as ReadonlyArray<Message> });

    // Same message arrives again after reset: must not be treated as new.
    rerender({ messages: [firstMessage] as ReadonlyArray<Message> });
    expect(setUnreadByConversationId).not.toHaveBeenCalled();
    expect(emitNewMessageSpy).not.toHaveBeenCalled();

    // Truly new message still increments unread once.
    rerender({ messages: [firstMessage, secondMessage] as ReadonlyArray<Message> });
    expect(setUnreadByConversationId).toHaveBeenCalledTimes(1);
    expect(unreadState["dm:peer-a"]).toBe(1);
    expect(emitNewMessageSpy).toHaveBeenCalledTimes(1);

    emitNewMessageSpy.mockRestore();
  });
});
