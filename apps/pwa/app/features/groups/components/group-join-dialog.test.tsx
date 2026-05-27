import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroupJoinDialog } from "./group-join-dialog";

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

vi.mock("../hooks/use-sealed-community", () => ({
    useSealedCommunity: () => ({
        state: {
            metadata: {
                name: "Test Room",
                about: "About",
            },
        },
        requestJoin: vi.fn(),
    }),
}));

vi.mock("../providers/group-provider", () => ({
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

});
