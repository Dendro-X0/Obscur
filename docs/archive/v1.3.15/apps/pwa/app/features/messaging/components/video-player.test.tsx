import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VideoPlayer } from "./video-player";

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

describe("VideoPlayer", () => {
    it("allows seeking with the custom progress control", () => {
        const { container } = render(
            <VideoPlayer
                src="https://cdn.example.com/video-sample.mp4"
                isOutgoing={false}
            />
        );

        const video = container.querySelector("video");
        if (!video) {
            throw new Error("Expected video element");
        }
        setMediaTiming(video, 80, 0);

        const seekControl = screen.getByLabelText("Video progress");
        fireEvent.change(seekControl, { target: { value: "50" } });

        expect(video.currentTime).toBeCloseTo(40, 3);
        expect((seekControl as HTMLInputElement).value).toBe("50");
        expect(screen.getByText("0:40")).toBeInTheDocument();
    });
});

