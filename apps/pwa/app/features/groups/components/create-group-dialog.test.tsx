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
    coordinationOnlyDev: true,
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

const fillValidCreateForm = async (): Promise<void> => {
    fireEvent.change(screen.getByPlaceholderText("Enter community name"), {
        target: { value: "Ops Room" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. groups.fiatjaf.com"), {
        target: { value: "localhost:7000" },
    });
    await waitFor(() => {
        expect(screen.getByRole("button", { name: "Create Group" })).toBeEnabled();
    });
};

describe("CreateGroupDialog", () => {
    beforeEach(() => {
        devFlagsMock.coordinationOnlyDev = true;
        vi.stubGlobal("crypto", {
            ...(globalThis.crypto ?? {}),
            randomUUID: () => "test-group-id",
        });
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
        relayListMock.relays = [{ url: "wss://relay.internal", enabled: true }];
    });

    it("defaults to managed workspace on intranet relay when coordination is healthy", async () => {
        render(
            <CreateGroupDialog
                isOpen
                onClose={vi.fn()}
                onCreate={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText("Intranet Workspace Candidate")).toBeInTheDocument();
        });
        expect(screen.getAllByText("Managed Workspace").length).toBeGreaterThan(0);

        await fillValidCreateForm();
    });

    it("shows public relay roster honesty when relay baseline is public default", async () => {
        devFlagsMock.coordinationOnlyDev = false;
        relayListMock.relays = [{ url: "wss://nos.lol", enabled: true }];
        render(
            <CreateGroupDialog
                isOpen
                onClose={vi.fn()}
                onCreate={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId("create-group-public-relay-honesty")).toBeInTheDocument();
        });
        expect(screen.getByText("Public relays do not guarantee live roster parity")).toBeInTheDocument();
    });

    it("blocks create on public relay hosts", async () => {
        render(
            <CreateGroupDialog
                isOpen
                onClose={vi.fn()}
                onCreate={vi.fn()}
            />,
        );

        await fillValidCreateForm();

        fireEvent.change(screen.getByPlaceholderText("e.g. groups.fiatjaf.com"), {
            target: { value: "nos.lol" },
        });

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Create Group" })).toBeDisabled();
            expect(screen.getByTestId("create-group-workspace-blocked")).toBeInTheDocument();
        });
    });

    it("submits managed workspace with trusted relay", async () => {
        const onCreate = vi.fn();
        render(
            <CreateGroupDialog
                isOpen
                onClose={vi.fn()}
                onCreate={onCreate}
            />,
        );

        await fillValidCreateForm();

        fireEvent.click(screen.getByRole("button", { name: "Create Group" }));

        expect(onCreate).toHaveBeenCalledTimes(1);
        expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
            host: "localhost:7000",
            name: "Ops Room",
            communityMode: "managed_workspace",
        });
    });
});
