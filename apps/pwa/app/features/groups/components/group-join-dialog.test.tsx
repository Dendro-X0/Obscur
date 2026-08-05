import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroupJoinDialog } from "./group-join-dialog";

const flags = {
    kernelAuthority: false,
    legacyMetadata: {
        name: "Test Room",
        about: "About",
    } as { name: string; about: string } | undefined,
};

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../../auth/hooks/use-identity", () => ({
    useIdentity: () => ({
        state: {
            publicKeyHex: "a".repeat(64),
            privateKeyHex: "b".repeat(64),
        },
    }),
}));

vi.mock("../../relays/providers/relay-provider", () => ({
    useRelay: () => ({
        relayPool: {
            addTransientRelay: vi.fn(),
        },
    }),
}));

vi.mock("../../relays/hooks/use-relay-pool-ref", () => ({
    useRelayPoolRef: (pool: unknown) => ({ current: pool }),
}));

vi.mock("@/app/features/workspace-kernel/workspace-kernel-policy", () => ({
    isWorkspaceKernelAuthority: () => flags.kernelAuthority,
}));

vi.mock("@/app/features/workspace-kernel/workspace-kernel-membership-port", () => ({
    joinManagedWorkspaceMembership: vi.fn(),
}));

vi.mock("../../relays/hooks/use-relay-list", () => ({
    useRelayList: () => ({
        addRelay: vi.fn(),
        state: { relays: [] },
    }),
}));

vi.mock("../services/community-workspace-membership", () => ({
    ensureWorkspaceMembershipSyncMode: vi.fn(),
}));

vi.mock("@/app/features/groups/hooks/sealed-community-port", () => ({
    useLegacySealedCommunity: () => ({
        state: {
            metadata: flags.legacyMetadata,
        },
        requestJoin: vi.fn(),
    }),
}));

vi.mock("@/app/features/groups/providers/group-provider-port", () => ({
    useGroups: () => ({
        addGroup: vi.fn(),
    }),
}));

vi.mock("../hooks/use-workspace-community-trust-gate", () => ({
    useWorkspaceCommunityTrustGate: () => ({
        trust: {
            allowed: false,
            userMessage: "Public relays cannot host workspace membership.",
            settingsHint: "Use a private relay.",
            reasonCode: "public_relay_blocked",
            coordinationConfigured: true,
            requiresManagedWorkspace: true,
            relayAssessment: { tier: "public_default" },
        },
        coordinationHealthy: true,
        blocked: true,
        refreshCoordinationHealth: vi.fn(),
    }),
    assertWorkspaceCommunityJoinAllowed: vi.fn(async () => ({
        allowed: false,
        userMessage: "Public relays cannot host workspace membership.",
        settingsHint: "Use a private relay.",
        reasonCode: "public_relay_blocked",
        coordination: { healthy: true, configured: true },
        relayAssessment: { tier: "public_default" },
        requiresManagedWorkspace: true,
    })),
}));

describe("GroupJoinDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        flags.kernelAuthority = false;
        flags.legacyMetadata = {
            name: "Test Room",
            about: "About",
        };
    });

    it("blocks join on public relay with workspace trust panel", () => {
        render(
            <GroupJoinDialog
                open
                onOpenChange={vi.fn()}
                groupId="group-1"
                relayUrl="wss://nos.lol"
            />,
        );

        expect(screen.getByTestId("group-join-workspace-blocked")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Join Community" })).toBeDisabled();
    });

    it("shows kernel preview when legacy metadata is absent", () => {
        flags.kernelAuthority = true;
        flags.legacyMetadata = undefined;
        render(
            <GroupJoinDialog
                open
                onOpenChange={vi.fn()}
                groupId="b93f53e23d8c4456835afd3f4d3a627b"
                relayUrl="ws://localhost:7000"
            />,
        );

        expect(screen.getByRole("button", { name: "Join Community" })).toBeInTheDocument();
        expect(screen.getByText(/Join Community b93f53e2/i)).toBeInTheDocument();
    });
});
