import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceNoteLightboxPlayer } from "./voice-note-lightbox-player";

vi.mock("@/app/features/runtime/native-host-adapter", () => ({
  openNativeExternal: vi.fn(async () => false),
}));

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

describe("VoiceNoteLightboxPlayer", () => {
  it("renders expanded preview chrome with metadata, volume, and external open", () => {
    render(
      <VoiceNoteLightboxPlayer
        src="https://cdn.example.com/voice-note.webm"
        voiceNoteMetadata={{
          isVoiceNote: true,
          recordedAtUnixMs: 1_774_262_057_407,
          durationSeconds: 9,
          durationLabel: "0:09",
        }}
      />,
    );

    expect(screen.getByText("Voice note")).toBeInTheDocument();
    expect(screen.getByLabelText("Play voice note")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Voice note progress" })).toBeInTheDocument();
    expect(screen.getByLabelText("Voice note volume")).toBeInTheDocument();
    expect(screen.getByLabelText("Open voice note externally")).toBeInTheDocument();
    expect(screen.getByText("0:09")).toBeInTheDocument();
  });
});
