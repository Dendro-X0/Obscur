import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyConversationView } from "./empty-conversation-view";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

describe("EmptyConversationView", () => {
    const baseProps = {
        showWelcome: false,
        myPublicKeyHex: null,
        relayStatus: { openCount: 0, total: 0 },
        onCopyMyPubkey: vi.fn(),
        onCopyChatLink: vi.fn(),
    };

    it("shows wait-for-sync hint in empty state when history sync notice is inactive", () => {
        render(
            <EmptyConversationView
                {...baseProps}
                showHistorySyncNotice={false}
            />
        );

        expect(screen.getByText("Missing contacts or chat history?")).toBeInTheDocument();
        expect(screen.getByText(/please wait a few minutes while loading and account data synchronization completes/i)).toBeInTheDocument();
    });

    it("shows syncing heading while history restore notice is active", () => {
        render(
            <EmptyConversationView
                {...baseProps}
                showHistorySyncNotice
            />
        );

        expect(screen.getByText("Syncing account history")).toBeInTheDocument();
        expect(screen.getByText(/please wait a few minutes while loading and account data synchronization completes/i)).toBeInTheDocument();
    });
});

