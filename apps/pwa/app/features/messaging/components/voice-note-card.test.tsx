import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceNoteCard } from "./voice-note-card";

vi.mock("@/app/features/messaging/hooks/use-voice-note-playback", () => ({
  useVoiceNotePlayback: () => ({
    audioRef: { current: null },
    runtimeSrc: "https://cdn.example.com/voice-note-1774262057407-d2.webm",
    peaks: [0.2, 0.8, 0.5, 0.9, 0.4],
    peaksReady: true,
    isPlaying: false,
    hasError: false,
    progressPercent: 0,
    timeLabel: "0:02",
    durationSeconds: 2,
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

describe("VoiceNoteCard", () => {
  it("keeps compatibility export for inline voice-note playback", () => {
    render(
      <VoiceNoteCard
        src="https://cdn.example.com/voice-note-1774262057407-d2.webm"
        isOutgoing
        voiceNoteMetadata={{
          isVoiceNote: true,
          recordedAtUnixMs: 1_774_262_057_407,
          durationSeconds: 2,
          durationLabel: "0:02",
        }}
      />,
    );

    expect(screen.getByLabelText("Play voice note")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Voice note progress" })).toBeInTheDocument();
    expect(screen.getByText("0:02")).toBeInTheDocument();
    expect(screen.queryByText("voice-note-1774262057407-d2.webm")).not.toBeInTheDocument();
  });
});
