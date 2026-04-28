import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GroupHomePage from "./group-home-page-client";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

vi.mock("next/navigation", () => ({
    useParams: () => ({ id: "community:testclub1:wss://relay.test" }),
    useRouter: () => ({ push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/features/groups/providers/group-provider", () => ({
    useGroups: () => ({
        createdGroups: [{
            kind: "group",
            id: "community:testclub1:wss://relay.test",
            communityId: "testclub1:wss://relay.test",
            groupId: "testclub1",
            relayUrl: "wss://relay.test",
            displayName: "Test Club",
            memberPubkeys: ["a".repeat(64), "b".repeat(64)],
            lastMessage: "",
            unreadCount: 0,
            lastMessageTime: new Date(1_000),
            access: "invite-only",
            memberCount: 2,
            adminPubkeys: ["a".repeat(64)],
        }],
        communityKnownParticipantDirectoryByConversationId: {
            "community:testclub1:wss://relay.test": {
                conversationId: "community:testclub1:wss://relay.test",
                groupId: "testclub1",
                relayUrl: "wss://relay.test",
                communityId: "testclub1:wss://relay.test",
                participantPubkeys: ["a".repeat(64), "b".repeat(64)],
                participantCount: 2,
            },
        },
        communityRosterByConversationId: {
            "community:testclub1:wss://relay.test": {
                conversationId: "community:testclub1:wss://relay.test",
                groupId: "testclub1",
                relayUrl: "wss://relay.test",
                communityId: "testclub1:wss://relay.test",
                activeMemberPubkeys: ["a".repeat(64), "b".repeat(64)],
                memberCount: 2,
            },
        },
        addGroup: vi.fn(),
        leaveGroup: vi.fn(),
    }),
}));

vi.mock("@/app/features/messaging/providers/messaging-provider", () => ({
    useMessaging: () => ({
        setSelectedConversation: vi.fn(),
    }),
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
    useIdentity: () => ({
        state: {
            publicKeyHex: "a".repeat(64),
            stored: { publicKeyHex: "a".repeat(64) },
            privateKeyHex: "c".repeat(64),
        },
    }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
    useRelay: () => ({
        relayPool: {
            subscribe: vi.fn(() => "sub"),
            unsubscribe: vi.fn(),
            publishToAll: vi.fn(async () => ({ success: true, successCount: 1, totalRelays: 1, results: [] })),
        },
    }),
}));

vi.mock("@/app/features/network/providers/network-provider", () => ({
    useNetwork: () => ({
        blocklist: {
            state: { blockedPublicKeys: [] },
            addBlocked: vi.fn(),
            removeBlocked: vi.fn(),
        },
        presence: {
            isPeerOnline: (pubkey: string) => pubkey === "a".repeat(64),
        },
    }),
}));

vi.mock("@/app/features/groups/hooks/use-sealed-community", () => ({
    toScopedRelayUrl: (value: string) => value,
    useSealedCommunity: () => ({
        state: {
            metadata: { id: "testclub1", name: "Test Club", access: "invite-only" },
            membership: { status: "member", role: "member" },
            messages: [],
            admins: [],
            leftMembers: [],
            expelledMembers: [],
            relayFeedback: {},
        },
        updateMetadata: vi.fn(),
        leaveGroup: vi.fn(),
        requestJoin: vi.fn(),
    }),
}));

vi.mock("@/app/components/page-shell", () => ({
    PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/app/features/profile/hooks/use-resolved-profile-metadata", () => ({
    useResolvedProfileMetadata: (pubkey: string) => (
        pubkey === "b".repeat(64)
            ? { isSelf: false, isDeleted: true, displayName: "Deleted Account" }
            : { isSelf: true, isDeleted: false, displayName: "Tester1" }
    ),
}));

vi.mock("@/app/features/search/services/discovery-cache", () => ({
    discoveryCache: {
        getProfile: vi.fn(() => null),
    },
}));

vi.mock("@/app/features/notifications/utils/notification-target-preference", () => ({
    isConversationNotificationsEnabled: () => true,
    setConversationNotificationsEnabled: vi.fn(),
}));

vi.mock("@/app/features/navigation/public-routes", () => ({
    getPublicGroupHref: () => "/groups/testclub1",
    getPublicProfileHref: (pubkey: string) => `/profile/${pubkey}`,
    toAbsoluteAppUrl: (value: string) => value,
}));

vi.mock("@/app/features/messaging/utils/conversation-target", () => ({
    resolveGroupConversationByToken: (groups: Array<unknown>) => groups[0],
}));

vi.mock("@/app/features/groups/utils/group-route-token", () => ({
    resolveGroupRouteToken: () => "community:testclub1:wss://relay.test",
}));

vi.mock("@/app/features/groups/utils/group-conversation-id", () => ({
    toGroupConversationId: () => "community:testclub1:wss://relay.test",
}));

vi.mock("@/app/features/settings/hooks/use-accessibility-preferences", () => ({
    useAccessibilityPreferences: () => ({
        preferences: { reducedMotion: false },
    }),
}));

vi.mock("@/app/shared/log-app-event", () => ({
    logAppEvent: vi.fn(),
}));

vi.mock("@/app/features/desktop/hooks/use-tauri", () => ({
    useIsDesktop: () => false,
}));

vi.mock("@/app/features/groups/components/invite-connections-dialog", () => ({
    InviteConnectionsDialog: () => null,
}));

vi.mock("@/app/components/ui/confirm-dialog", () => ({
    ConfirmDialog: () => null,
}));

vi.mock("@/app/features/profile/components/user-avatar", () => ({
    UserAvatar: ({ pubkey }: { pubkey: string }) => <div>{pubkey.slice(0, 2)}</div>,
}));

vi.mock("@dweb/ui-kit", () => ({
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
    Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AvatarFallback: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AvatarImage: () => null,
    cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("next/image", () => ({
    default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={props.alt} {...props} />,
}));

describe("GroupHomePage member profile rows", () => {
    it("keeps participant rows visible even when profile metadata is marked deleted", async () => {
        render(<GroupHomePage />);

        const openParticipantsButtons = await screen.findAllByRole("button", { name: /open participants/i });
        fireEvent.click(openParticipantsButtons[0]!);

        expect(await screen.findByText("Deleted Account")).toBeInTheDocument();
        expect(screen.getByText("Profile metadata unavailable")).toBeInTheDocument();
    });
});
