import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateGroupDialog } from "./create-group-dialog";
import en from "@/app/lib/i18n/locales/en.json";

const relayListMock = vi.hoisted(() => ({
    relays: [
        { url: "ws://localhost:7000", enabled: true },
    ],
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            const template = (en.translation as Record<string, string | undefined>)[key] ?? key;
            return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(options?.[token] ?? ""));
        },
    }),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/image", () => ({
    default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={props.alt} {...props} />,
}));

vi.mock("@/app/features/messaging/lib/upload-service", () => ({
    useUploadService: () => ({
        uploadFile: vi.fn(),
        pickFiles: vi.fn(async () => []),
    }),
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
    useIdentity: () => ({
        state: {
            publicKeyHex: "a".repeat(64),
        },
    }),
}));

vi.mock("@/app/features/relays/hooks/use-relay-list", () => ({
    LOCAL_DEV_RELAY_URL: "ws://localhost:7000",
    useRelayList: () => ({
        state: {
            relays: relayListMock.relays,
        },
    }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
    useRelay: () => ({
        relayPool: {
            connections: [{ url: "ws://localhost:7000", status: "open", updatedAtUnixMs: Date.now() }],
            getRelayHealth: () => undefined,
            addTransientRelay: vi.fn(),
            reconnectRelay: vi.fn(),
            waitForScopedConnection: vi.fn(async () => true),
        },
    }),
}));

vi.mock("../services/community-membership-sync-mode", () => ({
    isCoordinationConfigured: () => true,
}));

const devFlagsMock = vi.hoisted(() => ({
    coordinationOnlyDev: false,
}));

vi.mock("../services/community-dev-flags", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/community-dev-flags")>();
    return {
        ...actual,
        isCoordinationOnlyWorkspaceDevMode: () => devFlagsMock.coordinationOnlyDev,
    };
});

vi.mock("../hooks/use-workspace-dev-flags-revision", () => ({
    useWorkspaceDevFlagsRevision: () => 0,
}));

vi.mock("../services/community-coordination-health", () => ({
    probeCoordinationHealth: vi.fn(async () => ({
        configured: true,
        baseUrl: "http://127.0.0.1:8787",
        healthy: true,
        checkedAtMs: Date.now(),
    })),
}));

vi.mock("../../../components/ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({
        children,
        onClick,
    }: {
        children: React.ReactNode;
        onClick?: () => void;
    }) => <button type="button" onClick={onClick}>{children}</button>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("CreateGroupDialog", () => {
    beforeEach(() => {
        devFlagsMock.coordinationOnlyDev = false;
        vi.stubGlobal("crypto", {
            ...(globalThis.crypto ?? {}),
            randomUUID: () => "test-group-id",
        });
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
        relayListMock.relays = [{ url: "wss://relay.primal.net", enabled: true }];
    });

    it("defaults to quick group on public Quiet relays", async () => {
        render(
            <CreateGroupDialog
                isOpen
                onClose={vi.fn()}
                onCreate={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId("create-group-tier-quick")).toBeInTheDocument();
            expect(screen.getByTestId("create-group-public-relay-honesty")).toBeInTheDocument();
        });
        expect(screen.getByText("Public Quiet limits")).toBeInTheDocument();
        expect(screen.getByTestId("create-group-submit-gates")).toBeInTheDocument();
        expect(screen.queryByTestId("create-group-relay-baseline")).not.toBeInTheDocument();
        expect(screen.queryByTestId("create-group-mode-guarantees")).not.toBeInTheDocument();
        expect(screen.queryByText("Sovereign Room")).not.toBeInTheDocument();
    });

    it("enables create on public Quiet after honesty ack", async () => {
        const onCreate = vi.fn();
        render(
            <CreateGroupDialog
                isOpen
                onClose={vi.fn()}
                onCreate={onCreate}
            />,
        );

        fireEvent.change(screen.getByPlaceholderText("Enter community name"), {
            target: { value: "Friends" },
        });
        await waitFor(() => {
            expect(screen.getByTestId("create-group-public-limits-ack")).toBeInTheDocument();
            expect(screen.getByTestId("create-group-submit-gates")).toBeInTheDocument();
            expect(screen.getByTestId("create-group-disabled-reason")).toHaveTextContent(
                "Confirm public Quiet limits above to enable Create.",
            );
            expect(screen.getByTestId("create-group-submit")).toBeDisabled();
        });
        fireEvent.click(screen.getByTestId("create-group-public-limits-ack"));
        await waitFor(() => {
            expect(screen.getByTestId("create-group-submit")).toBeEnabled();
        });
        fireEvent.click(screen.getByTestId("create-group-submit"));
        expect(onCreate).toHaveBeenCalledTimes(1);
        expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
            name: "Friends",
            communityMode: "sovereign_room",
            hostingTier: "public_quiet",
        });
    });

    it("resets public limits ack when host changes", async () => {
        render(
            <CreateGroupDialog
                isOpen
                onClose={vi.fn()}
                onCreate={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId("create-group-public-limits-ack")).toBeInTheDocument();
        });
        fireEvent.click(screen.getByTestId("create-group-public-limits-ack"));
        expect(screen.getByTestId("create-group-public-limits-ack")).toBeChecked();

        fireEvent.change(screen.getByPlaceholderText("e.g. groups.fiatjaf.com"), {
            target: { value: "nos.lol" },
        });
        await waitFor(() => {
            expect(screen.getByTestId("create-group-public-limits-ack")).not.toBeChecked();
        });
    });

    it("team tier on public Quiet requires honesty ack, not hard-block (CU-UX-5)", async () => {
        const onCreate = vi.fn();
        render(
            <CreateGroupDialog
                isOpen
                onClose={vi.fn()}
                onCreate={onCreate}
            />,
        );

        fireEvent.click(screen.getByTestId("create-group-tier-team"));
        fireEvent.change(screen.getByPlaceholderText("Enter community name"), {
            target: { value: "Ops Room" },
        });
        fireEvent.change(screen.getByPlaceholderText("e.g. groups.fiatjaf.com"), {
            target: { value: "nos.lol" },
        });

        await waitFor(() => {
            expect(screen.getByTestId("create-group-public-relay-honesty")).toBeInTheDocument();
            expect(screen.getByTestId("create-group-workspace-trust-panel")).toBeInTheDocument();
            expect(screen.queryByTestId("create-group-workspace-blocked")).not.toBeInTheDocument();
            expect(screen.getByTestId("create-group-relay-baseline")).toBeInTheDocument();
            expect(screen.getByTestId("create-group-mode-guarantees")).toBeInTheDocument();
            expect(screen.getByTestId("create-group-submit")).toBeDisabled();
        });

        fireEvent.click(screen.getByTestId("create-group-public-limits-ack"));
        await waitFor(() => {
            expect(screen.getByTestId("create-group-submit")).toBeEnabled();
        });
        fireEvent.click(screen.getByTestId("create-group-submit"));
        expect(onCreate).toHaveBeenCalledTimes(1);
        expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
            name: "Ops Room",
            communityMode: "managed_workspace",
            hostingTier: "public_quiet",
        });
    });

    it("Escape closes create dialog without history.back", async () => {
        const onClose = vi.fn();
        const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
        try {
            render(
                <CreateGroupDialog
                    isOpen
                    onClose={onClose}
                    onCreate={vi.fn()}
                />,
            );
            expect(screen.getByTestId("create-group-dialog-layer")).toHaveAttribute(
                "data-escape-layer",
                "open",
            );
            fireEvent.keyDown(window, { key: "Escape" });
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(backSpy).not.toHaveBeenCalled();
        } finally {
            backSpy.mockRestore();
        }
    });
});
