import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateGroupDialog } from "./create-group-dialog";

const relayListMock = vi.hoisted(() => ({
    relays: [
        { url: "wss://relay.damus.io", enabled: true },
        { url: "wss://nos.lol", enabled: true },
    ],
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string, options?: Record<string, unknown>) => {
            if (!fallback) {
                return key;
            }
            return fallback.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(options?.[token] ?? ""));
        },
    }),
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
    useRelayList: () => ({
        state: {
            relays: relayListMock.relays,
        },
    }),
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
        vi.stubGlobal("crypto", {
            ...(globalThis.crypto ?? {}),
            randomUUID: () => "test-group-id",
        });
        relayListMock.relays = [
            { url: "wss://relay.damus.io", enabled: true },
            { url: "wss://nos.lol", enabled: true },
        ];
    });

    it("defaults to sovereign room on the public relay baseline", () => {
        render(
            <CreateGroupDialog
                isOpen
                onClose={vi.fn()}
                onCreate={vi.fn()}
            />,
        );

        expect(screen.getByText("Public Default")).toBeInTheDocument();
        expect(screen.getAllByText("Sovereign Room").length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

        expect(screen.getByText("Managed Workspace")).toBeInTheDocument();
        expect(screen.getByText(/requires trusted\/private relays/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create Group" })).toBeInTheDocument();
    });

    it("submits managed workspace selections when trusted relays are explicit", () => {
        relayListMock.relays = [
            { url: "wss://relay.internal", enabled: true },
            { url: "wss://chat.local", enabled: true },
        ];
        const onCreate = vi.fn();

        render(
            <CreateGroupDialog
                isOpen
                onClose={vi.fn()}
                onCreate={onCreate}
            />,
        );

        expect(screen.getByText("Intranet Workspace Candidate")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
        fireEvent.click(screen.getByRole("button", { name: /Managed Workspace/i }));
        fireEvent.change(screen.getByPlaceholderText("Enter community name"), {
            target: { value: "Ops Room" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Create Group" }));

        expect(onCreate).toHaveBeenCalledTimes(1);
        expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
            host: "nos.lol",
            name: "Ops Room",
            communityMode: "managed_workspace",
            relayCapabilityTier: "managed_intranet",
        });
    });
});
