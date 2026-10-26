"use client";

import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import {
    Play,
    Pause,
    Volume2,
    Maximize,
    Minimize2,
    Loader2,
    VideoOff,
    ExternalLink,
    ChevronUp,
    RotateCcw,
    RotateCw,
    PictureInPicture2,
} from "lucide-react";
import { cn } from "@dweb/ui-kit/cn";
import { classifyMediaError, type MediaErrorState } from "./media-error-state";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { motion, AnimatePresence } from "framer-motion";
import { LinkOpenConfirmDialog } from "@/app/features/security/components/link-open-confirm-dialog";
import { useGuardedExternalLinkOpen } from "@/app/features/security/hooks/use-guarded-external-link-open";
import { AppOverlayPortal } from "@/app/components/app-overlay-layer";
import { useChatAttachmentDisplaySrc } from "../hooks/use-chat-attachment-display-src";

interface VideoPlayerProps {
    src: string;
    isOutgoing: boolean;
    autoPlay?: boolean;
    className?: string;
    onRequestOpenExternalLink?: (url: string) => void | Promise<void>;
}

/**
 * Custom styled Video Player for the Obscur chat app.
 * Matches the aesthetic of the AudioPlayer with smooth transitions and premium feel.
 * Plays local vault / LES display src when available so sender bubbles do not stick
 * on a CDN placeholder (e.g. nostrcheck ostrich) after upload.
 */
export function VideoPlayer({ src, autoPlay = false, className, onRequestOpenExternalLink }: VideoPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [errorState, setErrorState] = useState<MediaErrorState | null>(null);
    const [runtimeSrc, setRuntimeSrc] = useState(src);
    const [hasRetriedWithBypass, setHasRetriedWithBypass] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [rateMenuOpen, setRateMenuOpen] = useState(false);
    const [isPipActive, setIsPipActive] = useState(false);
    const [pipSupported, setPipSupported] = useState(false);
    const [isCoarsePointer, setIsCoarsePointer] = useState(false);
    const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
    const SKIP_SECONDS = 10;
    /**
     * Window-scoped expand (fills the Obscur window via overlay portal).
     * Not OS `requestFullscreen` — WebView2 true FS leaves a taskbar-height gap.
     */
    const [isWindowPreview, setIsWindowPreview] = useState(false);
    const [fsControlsVisible, setFsControlsVisible] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const playbackSnapshotRef = useRef<Readonly<{ time: number; playing: boolean; rate: number; pending: boolean }>>({
        time: 0,
        playing: false,
        rate: 1,
        pending: false,
    });
    const fsHideControlsTimerRef = useRef<number | null>(null);
    const LOWER_CONTROL_ZONE = 0.62;
    const { displaySrc, recoverFromLoadFailure } = useChatAttachmentDisplaySrc(src);
    const {
      pendingLinkUrl,
      pendingLinkPhase,
      reputationResult,
      reputationChecking,
      reputationProviderLabel,
      cancelPendingLink,
      confirmPendingLink,
      requestOpenExternalLinkPreferNative,
    } = useGuardedExternalLinkOpen();

    const resolveDuration = (video: HTMLVideoElement | null): number => {
        if (!video) return 0;
        return Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    };

    useEffect(() => {
        setRuntimeSrc(displaySrc);
        setHasRetriedWithBypass(false);
        setIsLoading(true);
        setIsError(false);
        setErrorState(null);
        setIsPlaying(autoPlay);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
    }, [autoPlay, displaySrc]);

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return;
        }
        const pointerQuery = window.matchMedia("(pointer: coarse)");
        const updatePointerState = () => {
            setIsCoarsePointer(pointerQuery.matches);
        };
        updatePointerState();
        if (typeof pointerQuery.addEventListener === "function") {
            pointerQuery.addEventListener("change", updatePointerState);
            return () => pointerQuery.removeEventListener("change", updatePointerState);
        }
        pointerQuery.addListener(updatePointerState);
        return () => pointerQuery.removeListener(updatePointerState);
    }, []);

    useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }
        setPipSupported(Boolean(document.pictureInPictureEnabled));
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            return;
        }
        const onEnterPip = () => setIsPipActive(true);
        const onLeavePip = () => setIsPipActive(false);
        video.addEventListener("enterpictureinpicture", onEnterPip);
        video.addEventListener("leavepictureinpicture", onLeavePip);
        setIsPipActive(typeof document !== "undefined" && document.pictureInPictureElement === video);
        return () => {
            video.removeEventListener("enterpictureinpicture", onEnterPip);
            video.removeEventListener("leavepictureinpicture", onLeavePip);
        };
    }, [runtimeSrc, isWindowPreview]);

    const clearFsHideTimer = () => {
        if (fsHideControlsTimerRef.current != null) {
            window.clearTimeout(fsHideControlsTimerRef.current);
            fsHideControlsTimerRef.current = null;
        }
    };

    const scheduleFsControlsHide = () => {
        clearFsHideTimer();
        if (!isWindowPreview) {
            return;
        }
        // Prefer React play state — element `paused` can lag right after window-preview remount.
        if (!isPlaying) {
            return;
        }
        fsHideControlsTimerRef.current = window.setTimeout(() => {
            setFsControlsVisible(false);
            fsHideControlsTimerRef.current = null;
        }, 2_400);
    };

    const revealFsControls = (opts?: Readonly<{ holdOpen?: boolean }>) => {
        if (!isWindowPreview) {
            return;
        }
        setFsControlsVisible(true);
        if (opts?.holdOpen) {
            clearFsHideTimer();
            return;
        }
        scheduleFsControlsHide();
    };

    useEffect(() => {
        if (!isWindowPreview) {
            clearFsHideTimer();
            setFsControlsVisible(true);
            return clearFsHideTimer;
        }
        if (!isPlaying) {
            clearFsHideTimer();
            setFsControlsVisible(true);
            return clearFsHideTimer;
        }
        scheduleFsControlsHide();
        return clearFsHideTimer;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWindowPreview, isPlaying]);

    const isTypingTarget = (target: EventTarget | null): boolean => {
        if (!(target instanceof HTMLElement)) {
            return false;
        }
        const tag = target.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    };

    useEffect(() => {
        if (!rateMenuOpen) {
            return;
        }
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-video-rate-menu='1']")) {
                return;
            }
            setRateMenuOpen(false);
            if (isWindowPreview && isPlaying) {
                scheduleFsControlsHide();
            }
        };
        window.addEventListener("pointerdown", onPointerDown, true);
        return () => window.removeEventListener("pointerdown", onPointerDown, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rateMenuOpen, isWindowPreview, isPlaying]);

    const applyPlaybackSnapshot = () => {
        const video = videoRef.current;
        const snapshot = playbackSnapshotRef.current;
        if (!video || !snapshot.pending) {
            return;
        }
        if (Number.isFinite(snapshot.time) && snapshot.time >= 0) {
            try {
                video.currentTime = snapshot.time;
            } catch {
                /* ignore seek race while metadata loads */
            }
        }
        if (Number.isFinite(snapshot.rate) && snapshot.rate > 0) {
            video.playbackRate = snapshot.rate;
            setPlaybackRate(snapshot.rate);
        }
        if (snapshot.playing) {
            const playAttempt = video.play();
            if (playAttempt && typeof playAttempt.catch === "function") {
                playAttempt.catch(() => {
                    setIsPlaying(false);
                });
            }
            setIsPlaying(true);
        } else {
            if (!video.paused) {
                video.pause();
            }
            setIsPlaying(false);
        }
        playbackSnapshotRef.current = { ...snapshot, pending: false };
        setIsLoading(false);
    };

    useLayoutEffect(() => {
        applyPlaybackSnapshot();
    }, [isWindowPreview]);

    const openExternally = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        const requestOpen = onRequestOpenExternalLink ?? requestOpenExternalLinkPreferNative;
        await requestOpen(src);
    };

    const togglePlay = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const video = videoRef.current;
        if (!video) {
            return;
        }
        // Prefer element state — React `isPlaying` can desync after window-preview remount.
        if (!video.paused && !video.ended) {
            video.pause();
            setIsPlaying(false);
            revealFsControls({ holdOpen: true });
            return;
        }
        const playAttempt = video.play();
        if (playAttempt && typeof playAttempt.catch === "function") {
            playAttempt.catch(() => {
                setIsLoading(false);
                setIsError(true);
            });
        }
        setIsPlaying(true);
        revealFsControls();
    };

    const seekBySeconds = (deltaSeconds: number) => {
        const video = videoRef.current;
        if (!video) {
            return;
        }
        const nextDuration = resolveDuration(video);
        const current = Number.isFinite(video.currentTime) ? video.currentTime : currentTime;
        const uncapped = current + deltaSeconds;
        const nextTime = nextDuration > 0
            ? Math.max(0, Math.min(nextDuration, uncapped))
            : Math.max(0, uncapped);
        try {
            video.currentTime = nextTime;
        } catch {
            return;
        }
        setCurrentTime(nextTime);
        setProgress(nextDuration > 0 ? (nextTime / nextDuration) * 100 : 0);
        revealFsControls({ holdOpen: true });
    };

    const togglePictureInPicture = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const video = videoRef.current;
        if (!video || typeof document === "undefined" || !document.pictureInPictureEnabled) {
            return;
        }
        try {
            if (document.pictureInPictureElement === video) {
                await document.exitPictureInPicture();
                return;
            }
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            }
            await video.requestPictureInPicture();
            revealFsControls({ holdOpen: true });
        } catch {
            /* PiP can be blocked by policy / unsupported codecs */
        }
    };

    const handleWindowPreviewPointer = (event: React.MouseEvent | React.TouchEvent) => {
        if (!isWindowPreview) {
            return;
        }
        // Tap / click when chrome is hidden → show chrome only (YouTube-style).
        if (!fsControlsVisible) {
            event.preventDefault();
            event.stopPropagation();
            revealFsControls();
            return;
        }
        // Ignore clicks that originate on the control dock itself.
        const target = event.target as HTMLElement | null;
        if (target?.closest("[data-video-control-dock='1']")) {
            return;
        }
        togglePlay(event as React.MouseEvent);
    };

    const handleWindowPreviewMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!isWindowPreview) {
            setIsHovering(true);
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.height <= 0) {
            return;
        }
        const yRatio = (event.clientY - rect.top) / rect.height;
        if (yRatio >= LOWER_CONTROL_ZONE) {
            setIsHovering(true);
            // Stay visible while the pointer remains in the lower control zone.
            revealFsControls({ holdOpen: true });
            return;
        }
        setIsHovering(false);
        // Leaving the lower zone starts the hide timer while playing.
        scheduleFsControlsHide();
    };

    const handleTimeUpdate = () => {
        const video = videoRef.current;
        if (!video) return;
        const nextDuration = resolveDuration(video);
        const nextCurrentTime = Number.isFinite(video.currentTime) ? Math.max(0, video.currentTime) : 0;
        setCurrentTime(nextCurrentTime);
        setProgress(nextDuration > 0 ? (nextCurrentTime / nextDuration) * 100 : 0);
    };

    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        if (!video) return;
        setDuration(resolveDuration(video));
        setIsLoading(false);
        setIsError(false);
    };

    const handleCanPlay = () => {
        setIsLoading(false);
        setIsError(false);
        setErrorState(null);
    };

    const handleVideoError = () => {
        const v = videoRef.current;
        const err = v?.error;
        const details = {
            code: err?.code,
            message: err && "message" in err ? String((err as MediaError & { message?: unknown }).message) : undefined,
            src,
            displaySrc: runtimeSrc,
            currentSrc: v?.currentSrc,
            readyState: v?.readyState,
            networkState: v?.networkState,
        };
        const mediaError = classifyMediaError(new Error(String(details.message ?? "video_media_error")));
        logRuntimeEvent(
            `video_player.media_error.${mediaError.reasonCode}`,
            mediaError.recoverable ? "degraded" : "actionable",
            ["[VideoPlayer] media error", details],
            { windowMs: 30_000, maxPerWindow: 1, summaryEverySuppressed: 10 }
        );

        void (async () => {
            const recovered = await recoverFromLoadFailure();
            if (recovered) {
                setIsLoading(true);
                setIsError(false);
                setErrorState(null);
                return;
            }

            if (mediaError.reasonCode === "cache_unsupported" && !hasRetriedWithBypass) {
                setHasRetriedWithBypass(true);
                const separator = runtimeSrc.includes("?") ? "&" : "?";
                setRuntimeSrc(`${runtimeSrc}${separator}obscur_nocache=${Date.now()}`);
                setIsLoading(true);
                return;
            }

            setErrorState(mediaError);
            setIsLoading(false);
            setIsError(true);
        })();
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
    };

    const handleFullscreen = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const video = videoRef.current;
        playbackSnapshotRef.current = {
            time: video && Number.isFinite(video.currentTime) ? video.currentTime : currentTime,
            playing: Boolean(video && !video.paused && !video.ended),
            rate: video && Number.isFinite(video.playbackRate) && video.playbackRate > 0
                ? video.playbackRate
                : playbackRate,
            pending: true,
        };
        // Leave any OS fullscreen if a prior build entered it — window preview only.
        if (typeof document !== "undefined" && document.fullscreenElement) {
            void document.exitFullscreen?.().catch(() => undefined);
        }
        setIsWindowPreview((prev) => {
            const next = !prev;
            if (next) {
                setFsControlsVisible(true);
            }
            return next;
        });
    };

    const handleToggleMute = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        const nextMuted = !video.muted;
        video.muted = nextMuted;
        setIsMuted(nextMuted);
        revealFsControls({ holdOpen: true });
    };

    const handlePlayerKeyDown = (event: KeyboardEvent | React.KeyboardEvent) => {
        if (isTypingTarget(event.target)) {
            return;
        }
        const key = event.key;
        const code = "code" in event ? event.code : "";

        if (key === "Escape") {
            if (rateMenuOpen) {
                event.preventDefault();
                event.stopPropagation();
                setRateMenuOpen(false);
                return;
            }
            if (isWindowPreview) {
                event.preventDefault();
                event.stopPropagation();
                setIsWindowPreview(false);
            }
            return;
        }

        if (code === "Space" || key === " ") {
            event.preventDefault();
            event.stopPropagation();
            togglePlay();
            return;
        }
        if (key === "ArrowLeft") {
            event.preventDefault();
            event.stopPropagation();
            seekBySeconds(-SKIP_SECONDS);
            return;
        }
        if (key === "ArrowRight") {
            event.preventDefault();
            event.stopPropagation();
            seekBySeconds(SKIP_SECONDS);
            return;
        }
        if (key === "m" || key === "M") {
            event.preventDefault();
            event.stopPropagation();
            handleToggleMute();
            return;
        }
        if (key === "f" || key === "F") {
            event.preventDefault();
            event.stopPropagation();
            handleFullscreen();
        }
    };

    useEffect(() => {
        if (!isWindowPreview) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            handlePlayerKeyDown(event);
        };
        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWindowPreview, rateMenuOpen, isPlaying, playbackRate, currentTime]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        const nextVolume = Math.max(0, Math.min(1, Number(e.target.value)));
        video.volume = nextVolume;
        const nextMuted = nextVolume === 0;
        video.muted = nextMuted;
        setVolume(nextVolume);
        setIsMuted(nextMuted);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        const nextDuration = resolveDuration(video);
        if (nextDuration <= 0) return;
        const nextProgress = Math.max(0, Math.min(100, Number(e.target.value)));
        const nextTime = (nextProgress / 100) * nextDuration;
        video.currentTime = nextTime;
        setCurrentTime(nextTime);
        setProgress(nextProgress);
        revealFsControls({ holdOpen: true });
    };

    const applyPlaybackRate = (nextRate: number) => {
        const video = videoRef.current;
        const rate = Number.isFinite(nextRate) && nextRate > 0 ? nextRate : 1;
        if (video) {
            video.playbackRate = rate;
        }
        setPlaybackRate(rate);
        revealFsControls({ holdOpen: true });
    };

    const formatPlaybackRateLabel = (rate: number): string => {
        if (Math.abs(rate - 1) < 0.001) return "1x";
        if (Number.isInteger(rate)) return `${rate}x`;
        return `${rate.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}x`;
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const volumePercent = Math.round((isMuted ? 0 : volume) * 100);
    const progressPercent = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
    // Window preview always uses custom chrome (volume + play) — native FS controls were the old bug path.
    const useNativeMobileControls = isCoarsePointer && !isWindowPreview;
    const showControlDock = !useNativeMobileControls && !isError && (
        isWindowPreview
            ? fsControlsVisible
            : (isHovering || !isPlaying)
    );
    const showVolumeSliderExpanded = (isWindowPreview && fsControlsVisible) || isHovering;
    const showCenterPlay = !useNativeMobileControls && !isPlaying && !isError
        && (!isLoading || isWindowPreview)
        && (!isWindowPreview || fsControlsVisible);

    const stage = (
        <motion.div
            ref={containerRef}
            data-testid="video-player-stage"
            data-window-preview={isWindowPreview ? "1" : "0"}
            data-fs-controls={isWindowPreview ? (fsControlsVisible ? "1" : "0") : undefined}
            initial={false}
            onMouseLeave={() => {
                setIsHovering(false);
                if (isWindowPreview && isPlaying) {
                    scheduleFsControlsHide();
                }
            }}
            onMouseMove={handleWindowPreviewMouseMove}
            onClick={isWindowPreview ? handleWindowPreviewPointer : undefined}
            onKeyDown={handlePlayerKeyDown}
            tabIndex={0}
            className={cn(
                "group overflow-hidden flex items-center justify-center transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
                isWindowPreview
                    ? "relative h-full w-full rounded-none bg-black aspect-auto shadow-none ring-0"
                    : cn(
                        "relative rounded-[24px] aspect-video",
                        "bg-zinc-100 shadow-[0_20px_55px_rgba(15,23,42,0.15)] ring-1 ring-zinc-300/70",
                        "dark:bg-zinc-950 dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] dark:ring-white/10",
                        className,
                    ),
            )}
        >
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40 backdrop-blur-md">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
            )}

            {isError ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-white/95 p-8 text-center text-zinc-600 backdrop-blur-md dark:bg-zinc-900/50 dark:text-zinc-400">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-zinc-300/80 bg-zinc-100 shadow-2xl dark:border-white/5 dark:bg-zinc-950">
                        <VideoOff className="h-8 w-8 text-zinc-500/70 dark:text-white/20" />
                    </div>
                    <div className="space-y-1">
                        <div className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-700 dark:text-white/60">Playback Failed</div>
                        {errorState?.hint && (
                            <div className="mx-auto max-w-[280px] text-[10px] italic leading-relaxed text-zinc-500 dark:text-white/30">{errorState.hint}</div>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        <button
                            className="rounded-xl border border-zinc-300/80 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-800 transition-all hover:bg-zinc-100 active:scale-95 dark:border-white/5 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                            onClick={() => {
                                setIsError(false);
                                setIsLoading(true);
                                setErrorState(null);
                                videoRef.current?.load();
                            }}
                            disabled={!errorState?.canRetry}
                        >
                            Retry
                        </button>
                        <button
                            className="flex items-center gap-2 rounded-xl border border-zinc-300/80 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-600 transition-all hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/5 dark:bg-white/5 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
                            onClick={openExternally}
                            disabled={!errorState?.canOpenExternal}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Source
                        </button>
                    </div>
                </div>
            ) : (
                <video
                    key={runtimeSrc}
                    ref={videoRef}
                    src={runtimeSrc}
                    className={cn(
                        "w-full h-full object-contain",
                        !useNativeMobileControls && "cursor-pointer"
                    )}
                    onLoadStart={() => {
                        const restoring = playbackSnapshotRef.current.pending;
                        setIsLoading(true);
                        setIsError(false);
                        setErrorState(null);
                        if (restoring) {
                            setIsPlaying(playbackSnapshotRef.current.playing);
                            return;
                        }
                        setProgress(0);
                        setCurrentTime(0);
                        setDuration(0);
                        setIsPlaying(autoPlay);
                    }}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onLoadedMetadata={() => {
                        handleLoadedMetadata();
                        const video = videoRef.current;
                        if (video) {
                            video.playbackRate = playbackRate;
                        }
                        applyPlaybackSnapshot();
                    }}
                    onCanPlay={() => {
                        handleCanPlay();
                        const video = videoRef.current;
                        if (video) {
                            video.playbackRate = playbackRate;
                        }
                        applyPlaybackSnapshot();
                    }}
                    onError={handleVideoError}
                    onEnded={handleEnded}
                    onClick={useNativeMobileControls || isWindowPreview ? undefined : togglePlay}
                    playsInline
                    preload="metadata"
                    autoPlay={autoPlay && !playbackSnapshotRef.current.pending}
                    controls={useNativeMobileControls}
                    controlsList="nodownload noplaybackrate"
                />
            )}

            <AnimatePresence>
                {showCenterPlay ? (
                    <motion.button
                        type="button"
                        data-testid="video-player-center-play"
                        initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        onClick={(event) => {
                            event.stopPropagation();
                            togglePlay(event);
                        }}
                        className="absolute inset-0 flex items-center justify-center bg-transparent z-20"
                    >
                        <div className="h-24 w-24 rounded-full bg-white/10 backdrop-blur-2xl border border-white/20 flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-transform active:scale-90 group-hover:scale-110">
                            <div className="h-16 w-16 rounded-full bg-purple-600/20 blur-2xl absolute animate-pulse" />
                            <Play className="h-10 w-10 text-white fill-current ml-1.5 relative z-10" />
                        </div>
                    </motion.button>
                ) : null}
            </AnimatePresence>

            <AnimatePresence>
                {showControlDock && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                        className={cn(
                            "pointer-events-none absolute inset-x-0 z-30",
                            isWindowPreview
                                ? "bottom-0 px-0"
                                : "bottom-2 px-2 sm:bottom-6 sm:px-6",
                        )}
                        onMouseEnter={() => revealFsControls({ holdOpen: true })}
                        onMouseLeave={() => {
                            if (isWindowPreview && isPlaying && !rateMenuOpen) {
                                scheduleFsControlsHide();
                            }
                        }}
                    >
                        <div
                            data-video-control-dock="1"
                            data-testid="video-player-control-dock"
                            data-layout={isWindowPreview ? "edge" : "inline"}
                            className={cn(
                                "pointer-events-auto mx-auto flex w-full flex-col border border-zinc-300/80 bg-white/90 shadow-[0_16px_35px_rgba(15,23,42,0.2)] backdrop-blur-3xl dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-[0_16px_35px_rgba(0,0,0,0.55)]",
                                isWindowPreview
                                    ? "max-w-none gap-3 rounded-none border-x-0 border-b-0 bg-gradient-to-t from-black/85 via-zinc-950/75 to-zinc-950/40 p-3 pt-4 shadow-none dark:from-black/90 dark:via-zinc-950/80 dark:to-zinc-950/35 sm:gap-4 sm:px-6 sm:pb-5 sm:pt-5"
                                    : "max-w-4xl gap-2 rounded-2xl p-2.5 sm:gap-4 sm:rounded-[24px] sm:p-4 sm:shadow-[0_20px_50px_rgba(15,23,42,0.2)] dark:sm:shadow-[0_20px_50px_rgba(0,0,0,0.6)]",
                            )}
                        >
                            <div
                                className={cn(
                                    "group/seek relative flex w-full cursor-pointer items-center",
                                    isWindowPreview || isCoarsePointer ? "h-8" : "h-5",
                                )}
                            >
                                <div
                                    className={cn(
                                        "relative w-full rounded-full bg-zinc-200/90 transition-all dark:bg-white/10",
                                        isWindowPreview || isCoarsePointer
                                            ? "h-2.5 group-hover/seek:h-3 sm:h-3"
                                            : "h-1.5 group-hover/seek:h-2 sm:group-hover/seek:h-2.5",
                                    )}
                                >
                                    <div
                                        className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-purple-600 via-purple-500 to-blue-400 shadow-[0_0_10px_rgba(147,51,234,0.5)] transition-all duration-100"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                    <div
                                        className={cn(
                                            "absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-purple-500 bg-white shadow-2xl transition-all",
                                            isWindowPreview || isCoarsePointer
                                                ? "h-4 w-4 opacity-100 scale-100"
                                                : "h-3 w-3 scale-75 opacity-0 group-hover/seek:scale-100 group-hover/seek:opacity-100 sm:h-4 sm:w-4",
                                        )}
                                        style={{ left: `${progressPercent}%`, marginLeft: "-8px" }}
                                    />
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={progressPercent}
                                    onChange={handleSeek}
                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                    aria-label="Video progress"
                                />
                            </div>

                            <div className="flex items-center justify-between gap-2 px-0.5 sm:px-1">
                                <div className="flex min-w-0 items-center gap-1.5 sm:gap-4">
                                    <button
                                        type="button"
                                        data-testid="video-player-skip-back"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            seekBySeconds(-SKIP_SECONDS);
                                        }}
                                        className={cn(
                                            "shrink-0 rounded-xl p-1.5 text-zinc-600 transition-all hover:bg-zinc-100 hover:text-zinc-950 active:scale-95 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white",
                                            isWindowPreview && "text-white/70",
                                        )}
                                        aria-label={`Skip back ${SKIP_SECONDS} seconds`}
                                        title={`−${SKIP_SECONDS}s`}
                                    >
                                        <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </button>

                                    <button
                                        type="button"
                                        data-testid="video-player-dock-play"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            togglePlay(event);
                                        }}
                                        className={cn(
                                            "shrink-0 text-zinc-700 transition-all hover:scale-110 hover:text-zinc-950 active:scale-95 dark:text-white/70 dark:hover:text-white",
                                            (isWindowPreview || isCoarsePointer) && "rounded-xl p-1.5 -m-1.5",
                                        )}
                                        aria-label={isPlaying ? "Pause" : "Play"}
                                    >
                                        {isPlaying ? (
                                            <Pause className={cn("fill-current", isWindowPreview ? "h-6 w-6 sm:h-7 sm:w-7" : "h-5 w-5 sm:h-6 sm:w-6")} />
                                        ) : (
                                            <Play className={cn("fill-current", isWindowPreview ? "h-6 w-6 sm:h-7 sm:w-7" : "h-5 w-5 sm:h-6 sm:w-6")} />
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        data-testid="video-player-skip-forward"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            seekBySeconds(SKIP_SECONDS);
                                        }}
                                        className={cn(
                                            "shrink-0 rounded-xl p-1.5 text-zinc-600 transition-all hover:bg-zinc-100 hover:text-zinc-950 active:scale-95 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white",
                                            isWindowPreview && "text-white/70",
                                        )}
                                        aria-label={`Skip forward ${SKIP_SECONDS} seconds`}
                                        title={`+${SKIP_SECONDS}s`}
                                    >
                                        <RotateCw className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </button>

                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600 dark:text-white/50 sm:gap-3 sm:text-[11px] sm:tracking-[0.2em]">
                                        <span className={cn("tabular-nums", isWindowPreview ? "text-white/90" : "text-zinc-900 dark:text-white/90")}>{formatTime(currentTime)}</span>
                                        <span className="opacity-20 translate-y-[-1px]">|</span>
                                        <span className="tabular-nums">{formatTime(duration)}</span>
                                    </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
                                    <div className="relative" data-video-rate-menu="1">
                                        <button
                                            type="button"
                                            data-testid="video-player-playback-rate"
                                            aria-haspopup="menu"
                                            aria-expanded={rateMenuOpen}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setRateMenuOpen((open) => {
                                                    const next = !open;
                                                    if (next) {
                                                        revealFsControls({ holdOpen: true });
                                                    } else if (isWindowPreview && isPlaying) {
                                                        scheduleFsControlsHide();
                                                    }
                                                    return next;
                                                });
                                            }}
                                            className={cn(
                                                "inline-flex min-w-[2.75rem] items-center justify-center gap-1 rounded-xl border border-zinc-300/75 bg-white px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-700 transition-all hover:bg-zinc-100 hover:text-zinc-950 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white sm:min-w-[3.25rem] sm:px-2.5 sm:text-[11px]",
                                                isWindowPreview && "border-white/15 bg-white/10 text-white/85 sm:min-w-[3.5rem]",
                                            )}
                                            aria-label={`Playback speed ${formatPlaybackRateLabel(playbackRate)}`}
                                            title="Playback speed"
                                        >
                                            <span>{formatPlaybackRateLabel(playbackRate)}</span>
                                            <ChevronUp
                                                className={cn("h-3 w-3 opacity-60 transition-transform", rateMenuOpen && "rotate-180")}
                                                aria-hidden="true"
                                            />
                                        </button>
                                        {rateMenuOpen ? (
                                            <div
                                                role="menu"
                                                data-testid="video-player-playback-rate-menu"
                                                className={cn(
                                                    "absolute bottom-[calc(100%+0.5rem)] right-0 z-40 min-w-[8.5rem] overflow-hidden rounded-xl border border-zinc-300/80 bg-white/95 p-1 shadow-[0_16px_40px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/95",
                                                    isWindowPreview && "border-white/15 bg-zinc-950/95",
                                                )}
                                                onClick={(event) => event.stopPropagation()}
                                            >
                                                <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-white/40">
                                                    Speed
                                                </div>
                                                {PLAYBACK_RATES.map((rate) => {
                                                    const selected = Math.abs(rate - playbackRate) < 0.001;
                                                    return (
                                                        <button
                                                            key={rate}
                                                            type="button"
                                                            role="menuitemradio"
                                                            aria-checked={selected}
                                                            data-testid={`video-player-playback-rate-${formatPlaybackRateLabel(rate)}`}
                                                            className={cn(
                                                                "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[11px] font-black uppercase tracking-widest transition-colors",
                                                                selected
                                                                    ? "bg-purple-600/15 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200"
                                                                    : "text-zinc-700 hover:bg-zinc-100 dark:text-white/75 dark:hover:bg-white/10",
                                                            )}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                applyPlaybackRate(rate);
                                                                setRateMenuOpen(false);
                                                            }}
                                                        >
                                                            <span>{formatPlaybackRateLabel(rate)}</span>
                                                            {selected ? <span className="text-[9px] tracking-[0.2em] opacity-70">On</span> : null}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div
                                        className={cn(
                                            "group/volume items-center gap-2 rounded-full border border-zinc-300/75 bg-white px-2.5 py-1.5 transition-all hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 sm:gap-3 sm:px-3",
                                            isWindowPreview ? "hidden sm:flex" : "hidden md:flex",
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={handleToggleMute}
                                            className="text-zinc-500 transition-all hover:text-zinc-900 dark:text-white/40 dark:hover:text-white"
                                            aria-label={isMuted || volume === 0 ? "Unmute video" : "Mute video"}
                                        >
                                            {isMuted || volume === 0 ? (
                                                <VideoOff className="h-4 w-4 opacity-100" />
                                            ) : (
                                                <Volume2 className="h-4 w-4" />
                                            )}
                                        </button>
                                        <input
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={isMuted ? 0 : volume}
                                            onChange={handleVolumeChange}
                                            aria-label="Video volume"
                                            className={cn(
                                                "h-1 accent-purple-500 cursor-pointer overflow-hidden origin-right transition-all duration-500",
                                                showVolumeSliderExpanded ? "w-20 sm:w-24" : "w-0 group-hover/volume:w-20 sm:group-hover/volume:w-24",
                                            )}
                                        />
                                        <span
                                            className={cn(
                                                "w-12 text-right text-[9px] font-black lowercase tracking-widest text-zinc-500 dark:text-white/30",
                                                showVolumeSliderExpanded ? "block" : "hidden group-hover/volume:block",
                                            )}
                                        >
                                            {volumePercent}%
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleToggleMute}
                                        className={cn(
                                            "rounded-xl border border-zinc-300/75 bg-white p-2 text-zinc-600 transition-all hover:bg-zinc-100 hover:text-zinc-900 active:scale-90 dark:border-white/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20 dark:hover:text-white",
                                            isWindowPreview ? "sm:hidden" : "md:hidden",
                                        )}
                                        aria-label={isMuted || volume === 0 ? "Unmute video" : "Mute video"}
                                    >
                                        {isMuted || volume === 0 ? (
                                            <VideoOff className="h-4 w-4" />
                                        ) : (
                                            <Volume2 className="h-4 w-4" />
                                        )}
                                    </button>

                                    {pipSupported ? (
                                        <button
                                            type="button"
                                            data-testid="video-player-pip-toggle"
                                            onClick={(event) => {
                                                void togglePictureInPicture(event);
                                            }}
                                            className={cn(
                                                "rounded-xl border border-zinc-300/75 bg-white p-2 text-zinc-600 transition-all hover:bg-zinc-100 hover:text-zinc-900 active:scale-90 dark:border-white/10 dark:bg-white/5 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white",
                                                isPipActive && "border-purple-500/40 text-purple-600 dark:border-purple-400/40 dark:text-purple-300",
                                            )}
                                            aria-label={isPipActive ? "Exit picture in picture" : "Picture in picture"}
                                            aria-pressed={isPipActive}
                                            title="Picture in picture"
                                        >
                                            <PictureInPicture2 className="h-4 w-4" />
                                        </button>
                                    ) : null}

                                    <button
                                        type="button"
                                        data-testid="video-player-fullscreen-toggle"
                                        onClick={handleFullscreen}
                                        className="rounded-xl border border-zinc-300/75 bg-white p-2 text-zinc-600 transition-all hover:bg-zinc-100 hover:text-zinc-900 active:scale-90 dark:border-white/10 dark:bg-white/5 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                                        aria-label={isWindowPreview ? "Exit window preview" : "Expand in window"}
                                        aria-pressed={isWindowPreview}
                                    >
                                        {isWindowPreview ? (
                                            <Minimize2 className="h-4 w-4" />
                                        ) : (
                                            <Maximize className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );

    return (
        <>
        {isWindowPreview ? (
            <>
                <div
                    className={cn(
                        "aspect-video w-full rounded-[24px] bg-zinc-950/80 ring-1 ring-zinc-300/40 dark:ring-white/10",
                        className,
                    )}
                    aria-hidden="true"
                    data-testid="video-player-inline-placeholder"
                />
                <AppOverlayPortal>
                    <div
                        className="absolute inset-0 flex bg-black"
                        data-testid="video-player-window-preview"
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        {stage}
                    </div>
                </AppOverlayPortal>
            </>
        ) : (
            stage
        )}
        {!onRequestOpenExternalLink ? (
            <LinkOpenConfirmDialog
        url={pendingLinkUrl}
        phase={pendingLinkPhase}
        reputationResult={reputationResult}
        reputationChecking={reputationChecking}
        providerLabel={reputationProviderLabel}
        onClose={cancelPendingLink}
        onConfirm={() => { void confirmPendingLink(); }}
      />
        ) : null}
        </>
    );
}
