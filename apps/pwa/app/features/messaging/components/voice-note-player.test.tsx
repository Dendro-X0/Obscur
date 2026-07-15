import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceNotePlayer } from "./voice-note-player";

vi.mock("@/app/features/messaging/hooks/use-voice-note-playback", () => ({
  useVoiceNotePlayback: () => ({
    audioRef: { current: null },
    runtimeSrc: "https://cdn.example.com/voice-note.webm",
    peaks: [0.2, 0.8, 0.5, 0.9, 0.4],
    peaksReady: true,
    isPlaying: false,
    hasError: false,
    progressPercent: 0,
    timeLabel: "0:09",
    durationSeconds: 9,
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

describe("VoiceNotePlayer", () => {
  it("renders compact inline controls without legacy card chrome", () => {
    render(
      <VoiceNotePlayer
        src="https://cdn.example.com/voice-note.webm"
        isOutgoing
        voiceNoteMetadata={{
          isVoiceNote: true,
          recordedAtUnixMs: 1_774_262_057_407,
          durationSeconds: 9,
          durationLabel: "0:09",
        }}
      />,
    );

    expect(screen.getByLabelText("Play voice note")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Voice note progress" })).toBeInTheDocument();
    expect(screen.getByText("0:09")).toBeInTheDocument();
    expect(screen.queryByText("Voice Note")).not.toBeInTheDocument();
    expect(screen.queryByText("JUL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Open voice note in new tab")).not.toBeInTheDocument();
  });
});
