import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AudioPlayer } from "./audio-player";

vi.mock("@/app/features/runtime/native-host-adapter", () => ({
    openNativeExternal: vi.fn(async () => false),
}));

const setMediaTiming = (media: HTMLMediaElement, durationSeconds: number, initialCurrentTimeSeconds = 0): void => {
    let currentTimeSeconds = initialCurrentTimeSeconds;
    Object.defineProperty(media, "duration", {
        configurable: true,
        get: () => durationSeconds,
    });
    Object.defineProperty(media, "currentTime", {
        configurable: true,
        get: () => currentTimeSeconds,
        set: (value: number) => {
            currentTimeSeconds = value;
        },
    });
};

describe("AudioPlayer", () => {
    it("allows seeking with the progress control", () => {
        const { container } = render(
            <AudioPlayer
                src="https://cdn.example.com/audio-sample.mp3"
                isOutgoing={false}
            />
        );

        const audio = container.querySelector("audio");
        if (!audio) {
            throw new Error("Expected audio element");
        }
        setMediaTiming(audio, 120, 0);

        const seekControl = screen.getByLabelText("Audio progress");
        fireEvent.change(seekControl, { target: { value: "25" } });

        expect(audio.currentTime).toBeCloseTo(30, 3);
        expect((seekControl as HTMLInputElement).value).toBe("25");
        expect(screen.getByText("0:30")).toBeInTheDocument();
    });
});

