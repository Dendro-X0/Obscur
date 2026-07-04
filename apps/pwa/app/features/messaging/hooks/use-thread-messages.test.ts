import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { isDmKernelAuthority } from "@/app/features/dm-kernel/dm-kernel-policy";
import { useDmKernelThread } from "@/app/features/dm-kernel/use-dm-kernel-thread";
import { shouldUseLegacyConversationMessagesHydrate } from "./conversation-messages-legacy-port";
import { useThreadMessages } from "./use-thread-messages";
import type { DmConversation, GroupConversation } from "../types";

const loadEarlierMock = vi.fn(async () => undefined);

vi.mock("@/app/features/dm-kernel/dm-kernel-policy", () => ({
    isDmKernelAuthority: vi.fn(() => false),
}));

vi.mock("@/app/features/dm-kernel/use-dm-kernel-thread", () => ({
    useDmKernelThread: vi.fn(() => ({
        messages: [{ id: "kernel-msg-1" }],
        isLoading: false,
        hasEarlier: false,
        loadEarlier: loadEarlierMock,
        pendingEventCount: 0,
        hasHydrated: true,
    })),
}));

const useLegacyConversationMessagesMock = vi.fn(() => ({
    messages: [{ id: "msg-1" }],
    isLoading: false,
    hasEarlier: true,
    loadEarlier: loadEarlierMock,
    pendingEventCount: 2,
}));

const useInertConversationMessagesMock = vi.fn(() => ({
    messages: [],
    isLoading: false,
    hasEarlier: false,
    loadEarlier: loadEarlierMock,
    pendingEventCount: 0,
}));

const useGroupThreadMessagesMock = vi.fn(() => ({
    messages: [{ id: "group-msg-1" }],
    isLoading: false,
    hasEarlier: false,
    loadEarlier: loadEarlierMock,
    pendingEventCount: 0,
    hasHydrated: true,
}));

vi.mock("./conversation-messages-legacy-port", () => ({
    shouldUseLegacyConversationMessagesHydrate: vi.fn(() => true),
    useLegacyConversationMessages: (
        ...args: Parameters<typeof useLegacyConversationMessagesMock>
    ) => useLegacyConversationMessagesMock(...args),
}));

vi.mock("./use-inert-conversation-messages", () => ({
    useInertConversationMessages: (
        ...args: Parameters<typeof useInertConversationMessagesMock>
    ) => useInertConversationMessagesMock(...args),
}));

vi.mock("./use-group-thread-messages", () => ({
    useGroupThreadMessages: (
        ...args: Parameters<typeof useGroupThreadMessagesMock>
    ) => useGroupThreadMessagesMock(...args),
}));

const dmConversation: DmConversation = {
    kind: "dm",
    id: "dm-thread-1",
    pubkey: "a".repeat(64) as DmConversation["pubkey"],
    displayName: "Peer",
    lastMessage: "",
    unreadCount: 0,
    lastMessageTime: new Date(),
};

const groupConversation: GroupConversation = {
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

describe("useThreadMessages", () => {
    beforeEach(() => {
        vi.mocked(shouldUseLegacyConversationMessagesHydrate).mockReturnValue(true);
        vi.mocked(isDmKernelAuthority).mockReturnValue(false);
        useLegacyConversationMessagesMock.mockClear();
        useInertConversationMessagesMock.mockClear();
        useGroupThreadMessagesMock.mockClear();
        vi.mocked(useDmKernelThread).mockClear();
        loadEarlierMock.mockClear();
    });

    it("delegates DM threads to legacy hook when allow-legacy is on", () => {
        const { result } = renderHook(() => useThreadMessages(dmConversation, "b".repeat(64)));

        expect(useLegacyConversationMessagesMock).toHaveBeenCalledWith("dm-thread-1", "b".repeat(64));
        expect(useLegacyConversationMessagesMock).toHaveBeenCalledTimes(2);
        expect(useInertConversationMessagesMock).toHaveBeenCalledWith(undefined, "b".repeat(64));
        expect(result.current.messages).toEqual([{ id: "msg-1" }]);
        expect(result.current.hasEarlier).toBe(true);
        expect(result.current.pendingEventCount).toBe(2);
        expect(result.current.hasHydrated).toBe(true);
    });

    it("uses inert stub for web DM when allow-legacy is off", () => {
        vi.mocked(shouldUseLegacyConversationMessagesHydrate).mockReturnValue(false);
        const { result } = renderHook(() => useThreadMessages(dmConversation, "b".repeat(64)));

        expect(useInertConversationMessagesMock).toHaveBeenCalledWith("dm-thread-1", "b".repeat(64));
        expect(useLegacyConversationMessagesMock).toHaveBeenCalledWith(undefined, "b".repeat(64));
        expect(result.current.messages).toEqual([]);
        expect(result.current.hasHydrated).toBe(true);
    });

    it("routes group threads through useGroupThreadMessages without binding group ids to DM hydrate", () => {
        const { result } = renderHook(() => useThreadMessages(groupConversation, "b".repeat(64)));

        expect(useGroupThreadMessagesMock).toHaveBeenCalledWith(groupConversation, "b".repeat(64));
        expect(useLegacyConversationMessagesMock).toHaveBeenNthCalledWith(1, undefined, "b".repeat(64));
        expect(useLegacyConversationMessagesMock).toHaveBeenNthCalledWith(2, undefined, "b".repeat(64));
        expect(result.current.messages).toEqual([{ id: "group-msg-1" }]);
        expect(result.current.hasEarlier).toBe(false);
        expect(result.current.pendingEventCount).toBe(0);
        expect(result.current.hasHydrated).toBe(true);
        expect(result.current.isLoading).toBe(false);
    });

    it("keeps background DM hydration pinned while viewing a group", () => {
        renderHook(() => useThreadMessages(groupConversation, "b".repeat(64), {
            pinnedDmConversationId: "dm-thread-pinned",
        }));

        expect(useLegacyConversationMessagesMock).toHaveBeenNthCalledWith(1, undefined, "b".repeat(64));
        expect(useLegacyConversationMessagesMock).toHaveBeenNthCalledWith(2, "dm-thread-pinned", "b".repeat(64));
    });

    it("routes native DM through dm-kernel when authority is active", () => {
        vi.mocked(isDmKernelAuthority).mockReturnValue(true);
        const { result } = renderHook(() => useThreadMessages(dmConversation, "b".repeat(64)));

        expect(useDmKernelThread).toHaveBeenCalledWith("dm-thread-1", "b".repeat(64));
        expect(useLegacyConversationMessagesMock).toHaveBeenCalledWith(undefined, "b".repeat(64));
        expect(useInertConversationMessagesMock).toHaveBeenCalledWith(undefined, "b".repeat(64));
        expect(result.current.messages).toEqual([{ id: "kernel-msg-1" }]);
    });

    it("delegates group loadEarlier to useGroupThreadMessages", async () => {
        const groupLoadEarlier = vi.fn(async () => undefined);
        useGroupThreadMessagesMock.mockReturnValueOnce({
            messages: [],
            isLoading: false,
            hasEarlier: true,
            loadEarlier: groupLoadEarlier,
            pendingEventCount: 0,
            hasHydrated: true,
        });
        const { result } = renderHook(() => useThreadMessages(groupConversation, "b".repeat(64)));

        await result.current.loadEarlier();
        expect(groupLoadEarlier).toHaveBeenCalled();
    });
});
