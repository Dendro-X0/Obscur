import React from "react";
import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VideoPlayer } from "./video-player";

vi.mock("@/app/features/runtime/native-host-adapter", () => ({
    openNativeExternal: vi.fn(async () => false),
}));

vi.mock("../hooks/use-chat-attachment-display-src", () => ({
    useChatAttachmentDisplaySrc: (remoteUrl: string) => ({
        displaySrc: remoteUrl,
        recoverFromLoadFailure: vi.fn(async () => false),
        isRecovering: false,
    }),
}));

const setMediaTiming = (media: HTMLMediaElement, durationSeconds: number, initialCurrentTimeSeconds = 0): void => {
    let currentTimeSeconds = initialCurrentTimeSeconds;
    let paused = true;
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
    Object.defineProperty(media, "paused", {
        configurable: true,
        get: () => paused,
    });
    Object.defineProperty(media, "ended", {
        configurable: true,
        get: () => false,
    });
    media.play = vi.fn(async () => {
        paused = false;
        media.dispatchEvent(new Event("play"));
    }) as typeof media.play;
    media.pause = vi.fn(() => {
        paused = true;
        media.dispatchEvent(new Event("pause"));
    }) as typeof media.pause;
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
        fireEvent.loadedMetadata(video);
        fireEvent.canPlay(video);

        const seekControl = screen.getByLabelText("Video progress");
        fireEvent.change(seekControl, { target: { value: "50" } });

        expect(video.currentTime).toBeCloseTo(40, 3);
        expect((seekControl as HTMLInputElement).value).toBe("50");
        expect(screen.getByText("0:40")).toBeInTheDocument();
    });

    it("expands inside the app window overlay (not OS fullscreen) and keeps volume chrome", () => {
        const requestFullscreen = vi.fn();
        HTMLElement.prototype.requestFullscreen = requestFullscreen;

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
        setMediaTiming(video, 5, 1);
        fireEvent.loadedMetadata(video);
        fireEvent.canPlay(video);

        fireEvent.mouseEnter(screen.getByTestId("video-player-stage"));
        fireEvent.click(screen.getByTestId("video-player-fullscreen-toggle"));

        expect(requestFullscreen).not.toHaveBeenCalled();
        expect(screen.getByTestId("video-player-window-preview")).toBeInTheDocument();
        expect(screen.getByTestId("video-player-stage").getAttribute("data-window-preview")).toBe("1");
        expect(screen.getByLabelText("Video volume")).toBeInTheDocument();
        const dock = screen.getByTestId("video-player-control-dock");
        expect(dock.getAttribute("data-layout")).toBe("edge");
        expect(dock.className).toContain("max-w-none");

        fireEvent.keyDown(window, { key: "Escape" });
        expect(screen.queryByTestId("video-player-window-preview")).not.toBeInTheDocument();
    });

    it("selects playback speed from a dropdown menu", () => {
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
        setMediaTiming(video, 5, 0);
        Object.defineProperty(video, "playbackRate", {
            configurable: true,
            writable: true,
            value: 1,
        });
        fireEvent.loadedMetadata(video);
        fireEvent.canPlay(video);
        fireEvent.mouseEnter(screen.getByTestId("video-player-stage"));

        const rateButton = screen.getByTestId("video-player-playback-rate");
        expect(rateButton).toHaveTextContent("1x");
        fireEvent.click(rateButton);
        expect(screen.getByTestId("video-player-playback-rate-menu")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("video-player-playback-rate-1.5x"));
        expect(rateButton).toHaveTextContent("1.5x");
        expect(video.playbackRate).toBe(1.5);
        expect(screen.queryByTestId("video-player-playback-rate-menu")).not.toBeInTheDocument();
    });

    it("can resume playback after pausing inline then opening window preview", () => {
        const { container } = render(
            <VideoPlayer
                src="https://cdn.example.com/video-sample.mp4"
                isOutgoing={false}
            />
        );

        let video = container.querySelector("video");
        if (!video) {
            throw new Error("Expected video element");
        }
        setMediaTiming(video, 5, 1);
        fireEvent.loadedMetadata(video);
        fireEvent.canPlay(video);

        fireEvent.mouseEnter(screen.getByTestId("video-player-stage"));
        // Ensure paused snapshot before expand.
        act(() => {
            video!.pause();
        });

        fireEvent.click(screen.getByTestId("video-player-fullscreen-toggle"));

        const previewStage = screen.getByTestId("video-player-stage");
        expect(previewStage.getAttribute("data-window-preview")).toBe("1");

        video = previewStage.querySelector("video");
        if (!video) {
            throw new Error("Expected remounted video element");
        }
        setMediaTiming(video, 5, 1);
        fireEvent.loadedMetadata(video);
        fireEvent.canPlay(video);

        fireEvent.click(screen.getByTestId("video-player-dock-play"));
        expect(video.play).toHaveBeenCalled();
        expect(screen.getByLabelText("Pause")).toBeInTheDocument();
    });

    it("reveals window-preview controls when the pointer enters the lower zone", () => {
        vi.useFakeTimers();
        const { container } = render(
            <VideoPlayer
                src="https://cdn.example.com/video-sample.mp4"
                isOutgoing={false}
            />
        );
        let video = container.querySelector("video");
        if (!video) {
            throw new Error("Expected video element");
        }
        setMediaTiming(video, 5, 0);
        fireEvent.loadedMetadata(video);
        fireEvent.canPlay(video);
        act(() => {
            void video.play();
        });

        fireEvent.click(screen.getByTestId("video-player-fullscreen-toggle"));
        const stage = screen.getByTestId("video-player-stage");
        video = stage.querySelector("video");
        if (!video) {
            throw new Error("Expected remounted video element");
        }
        setMediaTiming(video, 5, 0);
        fireEvent.loadedMetadata(video);
        fireEvent.canPlay(video);
        act(() => {
            void video!.play();
        });

        Object.defineProperty(stage, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                top: 0,
                left: 0,
                bottom: 400,
                right: 800,
                width: 800,
                height: 400,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });

        // Upper zone should not keep controls forced visible after hide timer.
        // Assert data-fs-controls — AnimatePresence keeps the dock mounted during exit under fake timers.
        fireEvent.mouseMove(stage, { clientX: 100, clientY: 40 });
        act(() => {
            vi.advanceTimersByTime(2_500);
        });
        expect(stage.getAttribute("data-fs-controls")).toBe("0");

        // Lower zone reveals controls and holds them open.
        fireEvent.mouseMove(stage, { clientX: 100, clientY: 360 });
        expect(stage.getAttribute("data-fs-controls")).toBe("1");
        expect(screen.getByTestId("video-player-dock-play")).toBeInTheDocument();
        act(() => {
            vi.advanceTimersByTime(2_500);
        });
        expect(stage.getAttribute("data-fs-controls")).toBe("1");
        vi.useRealTimers();
    });

    it("reveals window-preview controls on tap when chrome is hidden", () => {
        vi.useFakeTimers();
        const { container } = render(
            <VideoPlayer
                src="https://cdn.example.com/video-sample.mp4"
                isOutgoing={false}
            />
        );
        let video = container.querySelector("video");
        if (!video) {
            throw new Error("Expected video element");
        }
        setMediaTiming(video, 5, 0);
        fireEvent.loadedMetadata(video);
        fireEvent.canPlay(video);
        act(() => {
            void video.play();
        });

        fireEvent.click(screen.getByTestId("video-player-fullscreen-toggle"));
        const stage = screen.getByTestId("video-player-stage");
        video = stage.querySelector("video");
        if (!video) {
            throw new Error("Expected remounted video element");
        }
        setMediaTiming(video, 5, 0);
        fireEvent.loadedMetadata(video);
        fireEvent.canPlay(video);
        act(() => {
            void video!.play();
        });

        fireEvent.mouseMove(stage, { clientX: 10, clientY: 10 });
        act(() => {
            vi.advanceTimersByTime(2_500);
        });
        expect(stage.getAttribute("data-fs-controls")).toBe("0");

        fireEvent.click(stage);
        expect(stage.getAttribute("data-fs-controls")).toBe("1");
        expect(screen.getByTestId("video-player-dock-play")).toBeInTheDocument();
        vi.useRealTimers();
    });

    it("skips backward and forward by 10 seconds from dock controls", () => {
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
        setMediaTiming(video, 80, 20);
        fireEvent.loadedMetadata(video);
        fireEvent.canPlay(video);
        fireEvent.mouseEnter(screen.getByTestId("video-player-stage"));

        fireEvent.click(screen.getByTestId("video-player-skip-back"));
        expect(video.currentTime).toBeCloseTo(10, 3);
        fireEvent.click(screen.getByTestId("video-player-skip-forward"));
        expect(video.currentTime).toBeCloseTo(20, 3);
    });

    it("handles arrow, mute, and expand keyboard shortcuts", () => {
        const { container } = render(
            <VideoPlayer
                src="https://cdn.example.com/video-sample.mp4"
                isOutgoing={false}
            />
        );
        const video = container.querySelector("video") as HTMLVideoElement;
        setMediaTiming(video, 80, 30);
        Object.defineProperty(video, "muted", {
            configurable: true,
            writable: true,
            value: false,
        });
        fireEvent.loadedMetadata(video);
        fireEvent.canPlay(video);

        const stage = screen.getByTestId("video-player-stage");
        stage.focus();
        fireEvent.keyDown(stage, { key: "ArrowLeft", code: "ArrowLeft" });
        expect(video.currentTime).toBeCloseTo(20, 3);
        fireEvent.keyDown(stage, { key: "ArrowRight", code: "ArrowRight" });
        expect(video.currentTime).toBeCloseTo(30, 3);

        fireEvent.keyDown(stage, { key: "m", code: "KeyM" });
        expect(video.muted).toBe(true);

        fireEvent.keyDown(stage, { key: "f", code: "KeyF" });
        expect(screen.getByTestId("video-player-window-preview")).toBeInTheDocument();
    });

    it("requests picture-in-picture when supported", async () => {
        const requestPictureInPicture = vi.fn(async () => undefined);
        Object.defineProperty(document, "pictureInPictureEnabled", {
            configurable: true,
            value: true,
        });
        Object.defineProperty(document, "pictureInPictureElement", {
            configurable: true,
            writable: true,
            value: null,
        });
        document.exitPictureInPicture = vi.fn(async () => undefined) as typeof document.exitPictureInPicture;

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
        setMediaTiming(video, 5, 0);
        video.requestPictureInPicture = requestPictureInPicture as typeof video.requestPictureInPicture;
        fireEvent.loadedMetadata(video);
        fireEvent.canPlay(video);
        fireEvent.mouseEnter(screen.getByTestId("video-player-stage"));

        fireEvent.click(screen.getByTestId("video-player-pip-toggle"));
        await act(async () => {
            await Promise.resolve();
        });
        expect(requestPictureInPicture).toHaveBeenCalled();
    });
});
