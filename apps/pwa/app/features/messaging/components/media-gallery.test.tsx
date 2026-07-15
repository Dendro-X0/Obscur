import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppOverlayRoot, APP_OVERLAY_ROOT_ID } from "@/app/components/app-overlay-layer";
import { MediaGallery } from "./media-gallery";
import type { MediaItem } from "../types";
import en from "@/app/lib/i18n/locales/en.json";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            const template = (en.translation as Record<string, string | undefined>)[key] ?? key;
            return template.replace(/\{\{\s*([^\s}]+)\s*\}\}/g, (_match, token: string) => String(options?.[token] ?? ""));
        },
    }),
}));

vi.mock("@/app/features/vault/services/save-chat-attachment-to-vault", () => ({
    canSaveChatAttachmentsToLocalVault: vi.fn(() => false),
    isChatAttachmentSavedToLocalVault: vi.fn(async () => false),
    saveChatAttachmentToLocalVault: vi.fn(async () => true),
}));

vi.mock("next/image", () => ({
    default: ({ unoptimized: _unused, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => (
        <img {...props} alt={props.alt ?? ""} />
    ),
}));

const createMediaItem = (overrides: Partial<MediaItem>): MediaItem => ({
    messageId: "m-default",
    timestamp: new Date(1_000),
    attachment: {
        kind: "image",
        url: "https://cdn.example.com/default.png",
        contentType: "image/png",
        fileName: "default.png",
    },
    ...overrides,
});

describe("MediaGallery", () => {
    it("renders through the app overlay root above the app shell stacking context", () => {
        render(
            <>
                <AppOverlayRoot />
                <MediaGallery
                    isOpen
                    onClose={vi.fn()}
                    conversationDisplayName="Test Chat"
                    mediaItems={[]}
                    onSelect={vi.fn()}
                />
            </>,
        );

        const overlayRoot = document.getElementById(APP_OVERLAY_ROOT_ID);
        const backdrop = overlayRoot?.querySelector('[data-escape-layer="open"]');
        expect(backdrop).not.toBeNull();
        expect(backdrop?.className).toContain("z-[10100]");
    });

    it("renders voice-note label and duration in audio tiles", () => {
        const voiceItem = createMediaItem({
            messageId: "m-voice",
            attachment: {
                kind: "voice_note",
                url: "https://cdn.example.com/voice-note-1774249000000-d64.webm",
                contentType: "audio/webm",
                fileName: "voice-note-1774249000000-d64.webm",
            },
        });

        render(
            <>
                <AppOverlayRoot />
                <MediaGallery
                    isOpen
                    onClose={vi.fn()}
                    conversationDisplayName="Test Chat"
                    mediaItems={[voiceItem]}
                    onSelect={vi.fn()}
                />
            </>,
        );

        expect(screen.getByText("Voice Note")).toBeInTheDocument();
        expect(screen.getByText("1:04")).toBeInTheDocument();
    });

    it("filters gallery items to voice notes only", () => {
        const imageItem = createMediaItem({
            messageId: "m-image",
            attachment: {
                kind: "image",
                url: "https://cdn.example.com/image-1.png",
                contentType: "image/png",
                fileName: "image-1.png",
            },
        });
        const voiceItem = createMediaItem({
            messageId: "m-voice",
            attachment: {
                kind: "voice_note",
                url: "https://cdn.example.com/voice-note-1774249000000-d12.webm",
                contentType: "audio/webm",
                fileName: "voice-note-1774249000000-d12.webm",
            },
        });

        render(
            <>
                <AppOverlayRoot />
                <MediaGallery
                    isOpen
                    onClose={vi.fn()}
                    conversationDisplayName="Test Chat"
                    mediaItems={[imageItem, voiceItem]}
                    onSelect={vi.fn()}
                />
            </>,
        );

        expect(screen.getByAltText("image-1.png")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Voice Notes/i }));
        expect(screen.queryByAltText("image-1.png")).not.toBeInTheDocument();
        expect(screen.getByText("Voice Note")).toBeInTheDocument();
    });

    it("opens attachment context menu on tile right-click when vault save is enabled", async () => {
        const { canSaveChatAttachmentsToLocalVault } = await import("@/app/features/vault/services/save-chat-attachment-to-vault");
        vi.mocked(canSaveChatAttachmentsToLocalVault).mockReturnValue(true);

        const imageItem = createMediaItem({
            messageId: "m-image",
            attachment: {
                kind: "image",
                url: "https://cdn.example.com/image-1.png",
                contentType: "image/png",
                fileName: "image-1.png",
            },
        });

        render(
            <>
                <AppOverlayRoot />
                <MediaGallery
                    isOpen
                    onClose={vi.fn()}
                    conversationDisplayName="Test Chat"
                    mediaItems={[imageItem]}
                    onSelect={vi.fn()}
                />
            </>,
        );

        const tile = screen.getByAltText("image-1.png").closest("button");
        expect(tile).not.toBeNull();
        fireEvent.contextMenu(tile!);
        expect(await screen.findByTestId("attachment-context-menu")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save to Vault" })).toBeInTheDocument();
    });
});
