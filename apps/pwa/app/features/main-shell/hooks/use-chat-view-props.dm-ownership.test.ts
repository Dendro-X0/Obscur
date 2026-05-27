import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useChatViewProps } from "./use-chat-view-props";
import type { GroupConversation } from "../../messaging/types";

const useConversationMessagesMock = vi.fn(() => ({
    messages: [],
    isLoading: false,
    hasEarlier: false,
    loadEarlier: vi.fn(),
    pendingEventCount: 0,
}));

vi.mock("../../messaging/hooks/use-conversation-messages", () => ({
    useConversationMessages: (
        ...args: Parameters<typeof useConversationMessagesMock>
    ) => useConversationMessagesMock(...args),
}));

describe("useChatViewProps DM ownership", () => {
    it("does not bind group conversation ids to the DM message hook", () => {
        useConversationMessagesMock.mockClear();
        const group: GroupConversation = {
            kind: "group",
            id: "community:group-1",
            communityId: "group-1",
            groupId: "group-1",
            relayUrl: "wss://localhost:7000",
            displayName: "Group 1",
            memberPubkeys: [],
            lastMessage: "",
            unreadCount: 0,
            lastMessageTime: new Date(),
            access: "open",
            memberCount: 1,
            adminPubkeys: [],
        };
        renderHook(() => useChatViewProps({
            selectedConversation: group,
            myPublicKeyHex: "a".repeat(64),
        }));
        expect(useConversationMessagesMock).toHaveBeenCalledWith(undefined, "a".repeat(64));
    });
});
