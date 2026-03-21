import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar, type SidebarProps } from "./sidebar";
import type { Conversation, DmConversation, GroupConversation } from "../types";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

vi.mock("./sidebar-user-search", () => ({
    SidebarUserSearch: ({ query, onQueryChange, inputRef }: { query: string; onQueryChange: (value: string) => void; inputRef?: React.RefObject<HTMLInputElement | null> }) => (
        <input
            ref={inputRef}
            data-testid="sidebar-unified-search-input"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
        />
    ),
}));

vi.mock("./conversation-row", () => ({
    ConversationRow: ({ conversation }: { conversation: Conversation }) => (
        <div data-testid="conversation-row">{conversation.displayName}</div>
    ),
}));

vi.mock("./requests-inbox-panel", () => ({
    RequestsInboxPanel: () => <div data-testid="requests-panel" />,
}));

vi.mock("../../relays/components/relay-status-indicator", () => ({
    RelayStatusIndicator: () => <div data-testid="relay-status-indicator" />,
}));

const createDm = (index: number): DmConversation => ({
    kind: "dm",
    id: `dm-${index}`,
    displayName: `DM ${index}`,
    pubkey: `${index.toString(16).padStart(64, "0")}` as DmConversation["pubkey"],
    lastMessage: `hello ${index}`,
    unreadCount: 0,
    lastMessageTime: new Date(1_000_000 + index),
});

const createGroup = (index: number): GroupConversation => ({
    kind: "group",
    id: `group-${index}`,
    groupId: `group-id-${index}`,
    relayUrl: "wss://relay.example",
    displayName: `Group ${index}`,
    memberPubkeys: [],
    lastMessage: `group ${index}`,
    unreadCount: 0,
    lastMessageTime: new Date(2_000_000 + index),
    access: "open" as GroupConversation["access"],
    memberCount: 0,
    adminPubkeys: [],
});

const createBaseProps = (overrides: Partial<SidebarProps> = {}): SidebarProps => ({
    isNewChatOpen: false,
    setIsNewChatOpen: vi.fn(),
    isNewGroupOpen: false,
    setIsNewGroupOpen: vi.fn(),
    searchQuery: "",
    setSearchQuery: vi.fn(),
    searchInputRef: React.createRef<HTMLInputElement>(),
    hasHydrated: true,
    filteredConversations: [],
    selectConversation: vi.fn(),
    selectedConversation: null,
    unreadByConversationId: {},
    interactionByConversationId: {},
    nowMs: Date.now(),
    activeTab: "chats",
    setActiveTab: vi.fn(),
    requests: [],
    onAcceptRequest: vi.fn(),
    onIgnoreRequest: vi.fn(),
    onBlockRequest: vi.fn(),
    onSelectRequest: vi.fn(),
    pinnedChatIds: [],
    togglePin: vi.fn(),
    hiddenChatIds: [],
    hideConversation: vi.fn(),
    deleteConversation: vi.fn(),
    clearHistory: vi.fn(),
    onClearHistory: vi.fn(),
    isPeerOnline: vi.fn(() => false),
    ...overrides,
});

describe("Sidebar", () => {
    it("paginates DM list to 25 initially and 50 after load more", () => {
        const conversations = Array.from({ length: 60 }, (_, index) => createDm(index + 1));
        render(<Sidebar {...createBaseProps({ filteredConversations: conversations })} />);

        expect(screen.getAllByTestId("conversation-row")).toHaveLength(25);

        fireEvent.click(screen.getByTestId("sidebar-load-more-dms"));

        expect(screen.getAllByTestId("conversation-row")).toHaveLength(50);
        expect(screen.queryByTestId("sidebar-load-more-dms")).not.toBeInTheDocument();
    });

    it("paginates communities to 25 initially and 50 after load more", async () => {
        const groups = Array.from({ length: 60 }, (_, index) => createGroup(index + 1));
        render(
            <Sidebar
                {...createBaseProps({
                    filteredConversations: groups,
                    selectedConversation: groups[0],
                })}
            />
        );

        await waitFor(() => {
            expect(screen.getAllByTestId("conversation-row")).toHaveLength(25);
        });

        fireEvent.click(screen.getByTestId("sidebar-load-more-communities"));

        expect(screen.getAllByTestId("conversation-row")).toHaveLength(50);
        expect(screen.queryByTestId("sidebar-load-more-communities")).not.toBeInTheDocument();
    });

    it("uses one unified search input and forwards query changes", () => {
        const setSearchQuery = vi.fn();
        render(
            <Sidebar
                {...createBaseProps({
                    searchQuery: "starter",
                    setSearchQuery,
                })}
            />
        );

        const input = screen.getByTestId("sidebar-unified-search-input");
        expect(input).toHaveValue("starter");

        fireEvent.change(input, { target: { value: "new query" } });
        expect(setSearchQuery).toHaveBeenCalledWith("new query");

        expect(screen.getAllByRole("textbox")).toHaveLength(1);
    });
});
