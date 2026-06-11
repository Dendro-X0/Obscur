import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useChatViewProps } from "./use-chat-view-props";
import type { GroupConversation } from "../../messaging/types";

const useThreadMessagesMock = vi.fn(() => ({
    messages: [],
    isLoading: false,
    hasEarlier: false,
    loadEarlier: vi.fn(),
    pendingEventCount: 0,
    hasHydrated: true,
}));

vi.mock("../../messaging/hooks/use-thread-messages", () => ({
    useThreadMessages: (
        ...args: Parameters<typeof useThreadMessagesMock>
    ) => useThreadMessagesMock(...args),
}));

describe("useChatViewProps thread ownership", () => {
    it("routes group conversations through useThreadMessages without DM display binding", () => {
        useThreadMessagesMock.mockClear();
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
        expect(useThreadMessagesMock).toHaveBeenCalledWith(
            group,
            "a".repeat(64),
            { pinnedDmConversationId: undefined },
        );
    });
});
