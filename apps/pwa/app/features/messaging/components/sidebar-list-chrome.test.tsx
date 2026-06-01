import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarListChrome } from "./sidebar-list-chrome";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
}));

vi.mock("./sidebar-user-search", () => ({
    SidebarUserSearch: () => <input data-testid="sidebar-unified-search-input" />,
}));

const baseProps = {
    activeTab: "chats" as const,
    setActiveTab: vi.fn(),
    chatsUnreadTotal: 2,
    requestsUnreadTotal: 0,
    pendingRequestsCount: 0,
    searchQuery: "",
    setSearchQuery: vi.fn(),
    searchInputRef: { current: null },
    searchDismissSignal: "chats:direct:",
    onUserSelect: vi.fn(),
    chatViewMode: "direct" as const,
    setChatViewMode: vi.fn(),
    dmsUnread: 1,
    groupsUnread: 0,
    setIsNewChatOpen: vi.fn(),
    setIsNewGroupOpen: vi.fn(),
    areChatSectionsExpanded: true,
    onToggleChatSectionsExpanded: vi.fn(),
    onClearRequestHistory: vi.fn(),
};

describe("SidebarListChrome", () => {
    it("renders mobile chrome with search-first layout", () => {
        render(<SidebarListChrome {...baseProps} variant="mobile" />);
        expect(screen.getByTestId("sidebar-mobile-chrome")).toBeInTheDocument();
        expect(screen.getByTestId("sidebar-unified-search-input")).toBeInTheDocument();
        expect(screen.getByRole("tablist")).toBeInTheDocument();
    });
});
