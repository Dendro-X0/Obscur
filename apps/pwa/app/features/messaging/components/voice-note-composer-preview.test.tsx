import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceNoteComposerPreview } from "./voice-note-composer-preview";

vi.mock("@/app/features/messaging/hooks/use-voice-note-playback", () => ({
  useVoiceNotePlayback: () => ({
    audioRef: { current: null },
    runtimeSrc: "blob:voice-preview",
    peaks: [0.2, 0.8, 0.5, 0.9, 0.4],
    peaksReady: true,
    isPlaying: false,
    hasError: false,
    progressPercent: 0,
    timeLabel: "0:06",
    durationSeconds: 6,
    currentTimeSeconds: 0,
    volume: 1,
    isMuted: false,
    togglePlay: vi.fn(async () => {}),
    seekToPercent: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    retry: vi.fn(),
    audioProps: {},
  }),
}));

describe("VoiceNoteComposerPreview", () => {
  it("renders a playable mini preview for pending voice-note attachments", () => {
    render(
      <VoiceNoteComposerPreview
        file={new File(["audio"], "voice-note-1783869181902-d6.webm", { type: "audio/webm" })}
        previewUrl="blob:voice-preview"
      />,
    );

    expect(screen.getByLabelText("Play voice note")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Voice note progress" })).toBeInTheDocument();
    expect(screen.getByText("0:06")).toBeInTheDocument();
  });
});
