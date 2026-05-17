import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaGallery } from "./media-gallery";
import type { MediaItem } from "../types";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
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
            <MediaGallery
                isOpen
                onClose={vi.fn()}
                conversationDisplayName="Test Chat"
                mediaItems={[voiceItem]}
                onSelect={vi.fn()}
            />
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
            <MediaGallery
                isOpen
                onClose={vi.fn()}
                conversationDisplayName="Test Chat"
                mediaItems={[imageItem, voiceItem]}
                onSelect={vi.fn()}
            />
        );

        expect(screen.getByAltText("image-1.png")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Voice Notes/i }));
        expect(screen.queryByAltText("image-1.png")).not.toBeInTheDocument();
        expect(screen.getByText("Voice Note")).toBeInTheDocument();
    });
});
