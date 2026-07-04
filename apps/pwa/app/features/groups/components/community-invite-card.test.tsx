import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunityInviteCard } from "./community-invite-card";
import type { InvitePayload } from "../utils/community-invite-payload";
import en from "@/app/lib/i18n/locales/en.json";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            const template = (en.translation as Record<string, string | undefined>)[key] ?? key;
            return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(options?.[token] ?? ""));
        },
    }),
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
    useIdentity: () => ({
        state: {
            publicKeyHex: "bb".repeat(32),
            privateKeyHex: "cc".repeat(32),
        },
    }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
    useRelay: () => ({
        pool: { connections: [] },
    }),
}));

vi.mock("@/app/features/relays/hooks/use-relay-list", () => ({
    useRelayList: () => ({
        state: { relays: [] },
    }),
}));

vi.mock("@/app/features/groups/providers/group-provider-port", () => ({
    useGroups: () => ({
        createdGroups: [],
    }),
}));

vi.mock("@/app/features/crypto/room-key-store", () => ({
    roomKeyStore: {
        getRoomKey: vi.fn(async () => "room-key-hex"),
    },
}));

vi.mock("../services/community-invite-relay-join", () => ({
    loadInviteRelayJoinState: () => ({ status: "not_attempted", manualRetryCount: 0, updatedAtUnixMs: 0 }),
    shouldShowInviteRelayJoinRetry: () => false,
}));

const baseInvite: InvitePayload = {
    type: "community-invite",
    groupId: "group-test",
    roomKey: "room-key-hex",
    metadata: {
        id: "group-test",
        name: "Test Community",
        access: "invite-only",
    },
};

describe("CommunityInviteCard — IRA-4 viewerRole permissions", () => {
    it("shows Accept and Decline for invitee on pending invite", () => {
        render(
            <CommunityInviteCard
                invite={baseInvite}
                viewerRole="invitee"
                responseStatus="pending"
            />,
        );

        const card = screen.getByTestId("community-invite-card");
        expect(card).toHaveAttribute("data-invite-viewer-role", "invitee");
        expect(card).toHaveAttribute("data-invite-direction", "incoming");
        expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /cancel invitation/i })).not.toBeInTheDocument();
    });

    it("shows Cancel for inviter on pending invite", () => {
        render(
            <CommunityInviteCard
                invite={baseInvite}
                viewerRole="inviter"
                responseStatus="pending"
            />,
        );

        const card = screen.getByTestId("community-invite-card");
        expect(card).toHaveAttribute("data-invite-viewer-role", "inviter");
        expect(card).toHaveAttribute("data-invite-direction", "outgoing");
        expect(screen.getByRole("button", { name: /cancel invitation/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^accept$/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /decline/i })).not.toBeInTheDocument();
    });

    it("shows no action buttons for observer on pending invite", () => {
        render(
            <CommunityInviteCard
                invite={baseInvite}
                viewerRole="observer"
                responseStatus="pending"
            />,
        );

        expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /decline/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /cancel invitation/i })).not.toBeInTheDocument();
    });
});
