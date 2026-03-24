import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceNoteCard } from "./voice-note-card";

vi.mock("@/app/features/runtime/native-host-adapter", () => ({
    openNativeExternal: vi.fn(async () => false),
}));

describe("VoiceNoteCard", () => {
    it("renders minimalist voice-note metadata separate from generic audio cards", () => {
        render(
            <VoiceNoteCard
                src="https://cdn.example.com/voice-note-1774262057407-d2.webm"
                isOutgoing
                fileName="voice-note-1774262057407-d2.webm"
                sourceLabel="video.nostr.build"
                voiceNoteMetadata={{
                    isVoiceNote: true,
                    recordedAtUnixMs: 1_774_262_057_407,
                    durationSeconds: 2,
                    durationLabel: "0:02",
                }}
            />
        );

        expect(screen.getByText("Voice Note")).toBeInTheDocument();
        expect(screen.getByText("Voice Notes")).toBeInTheDocument();
        expect(screen.queryByText("voice-note-1774262057407-d2.webm")).not.toBeInTheDocument();
        expect(screen.getByText("video.nostr.build")).toBeInTheDocument();
        expect(screen.getAllByText("0:02").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByLabelText("Voice note progress")).toBeInTheDocument();
    });
});
