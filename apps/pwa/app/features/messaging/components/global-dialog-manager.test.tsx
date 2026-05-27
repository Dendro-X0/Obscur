import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalDialogManager } from "./global-dialog-manager";

const messagingMock = vi.hoisted(() => ({
    isNewChatOpen: false,
    isNewGroupOpen: true,
    setCreatedConnections: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock("@/app/features/messaging/providers/messaging-provider", () => ({
    useMessaging: () => ({
        isNewChatOpen: messagingMock.isNewChatOpen,
        setIsNewChatOpen: vi.fn(),
        newChatPubkey: "",
        setNewChatPubkey: vi.fn(),
        newChatDisplayName: "",
        setNewChatDisplayName: vi.fn(),
        createdConnections: [],
        setCreatedConnections: messagingMock.setCreatedConnections,
        setSelectedConversation: vi.fn(),
        unhideConversation: vi.fn(),
    }),
}));

vi.mock("@/app/features/groups/providers/group-provider", () => ({
    useGroups: () => ({
        isNewGroupOpen: messagingMock.isNewGroupOpen,
        setIsNewGroupOpen: vi.fn(),
        isCreatingGroup: false,
        setIsCreatingGroup: vi.fn(),
        addGroup: vi.fn(),
    }),
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
    useIdentity: () => ({
        state: { publicKeyHex: "a".repeat(64), privateKeyHex: "b".repeat(64) },
    }),
}));

vi.mock("@/app/features/network/providers/network-provider", () => ({
    useNetwork: () => ({
        peerTrust: { isAccepted: () => true },
        blocklist: [],
        requestsInbox: { setStatus: vi.fn() },
    }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
    useRelay: () => ({
        relayPool: {
            connections: [],
            addTransientRelay: vi.fn(),
        },
    }),
}));

vi.mock("@/app/features/relays/hooks/use-relay-pool-ref", () => ({
    useRelayPoolRef: (pool: unknown) => ({ current: pool }),
}));

vi.mock("@/app/features/relays/hooks/use-relay-list", () => ({
    useRelayList: () => ({ state: { relays: [] }, addRelay: vi.fn() }),
    LOCAL_DEV_RELAY_URL: "ws://localhost:7000",
}));

vi.mock("@/app/features/messaging/hooks/use-enhanced-dm-controller", () => ({
    useEnhancedDmController: () => ({}),
}));

vi.mock("@/app/features/messaging/hooks/use-request-transport", () => ({
    useRequestTransport: () => ({ sendRequest: vi.fn() }),
}));

vi.mock("@/app/features/search/hooks/use-profile-search-service-ref", () => ({
    useProfileSearchServiceRef: () => ({ searchByName: vi.fn() }),
}));

vi.mock("@/app/features/groups/components/create-group-dialog", () => ({
    CreateGroupDialog: () => <div data-testid="create-group-dialog-stub" />,
}));

vi.mock("@/app/features/messaging/components/new-chat-dialog", () => ({
    NewChatDialog: () => null,
}));

describe("GlobalDialogManager", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        messagingMock.isNewGroupOpen = true;
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
    });

    it("renders create group dialog without ReferenceError when messaging setter is wired", () => {
        expect(() => render(<GlobalDialogManager />)).not.toThrow();
        expect(screen.getByTestId("create-group-dialog-stub")).toBeInTheDocument();
    });
});
