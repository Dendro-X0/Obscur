"use client";

import React, { useEffect, useState, useRef } from "react";
import { Play, Pause, Volume2, Maximize, Loader2, VideoOff, ExternalLink } from "lucide-react";
import { cn } from "@dweb/ui-kit";
import { classifyMediaError, type MediaErrorState } from "./media-error-state";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { motion, AnimatePresence } from "framer-motion";
import { openNativeExternal } from "@/app/features/runtime/native-host-adapter";

interface VideoPlayerProps {
    src: string;
    isOutgoing: boolean;
    autoPlay?: boolean;
    className?: string;
}

/**
 * Custom styled Video Player for the Obscur chat app.
 * Matches the aesthetic of the AudioPlayer with smooth transitions and premium feel.
 */
export function VideoPlayer({ src, isOutgoing, autoPlay = false, className }: VideoPlayerProps) {
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
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setRuntimeSrc(src);
        setHasRetriedWithBypass(false);
    }, [src]);

    const openExternally = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        try {
            const openedNatively = await openNativeExternal(src);
            if (openedNatively) {
                return;
            } 
        } catch {
            // ignore
        }

        try {
            window.open(src, "_blank", "noopener,noreferrer");
        } catch {
            // ignore
        }
    };

    const togglePlay = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                const p = videoRef.current.play();
                if (p && typeof (p as Promise<void>).catch === "function") {
                    (p as Promise<void>).catch(() => {
                        setIsLoading(false);
                        setIsError(true);
                    });
                }
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            const d = videoRef.current.duration;
            setProgress(d > 0 ? (videoRef.current.currentTime / d) * 100 : 0);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
            setIsLoading(false);
            setIsError(false);
        }
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

        if (mediaError.reasonCode === "cache_unsupported" && !hasRetriedWithBypass) {
            setHasRetriedWithBypass(true);
            const separator = src.includes("?") ? "&" : "?";
            setRuntimeSrc(`${src}${separator}obscur_nocache=${Date.now()}`);
            setIsLoading(true);
            return;
        }

        setErrorState(mediaError);
        setIsLoading(false);
        setIsError(true);
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
    };

    const handleFullscreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current?.requestFullscreen) {
            videoRef.current.requestFullscreen();
        }
    };

    const handleToggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        const nextMuted = !video.muted;
        video.muted = nextMuted;
        setIsMuted(nextMuted);
    };

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

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const volumePercent = Math.round((isMuted ? 0 : volume) * 100);

    return (
        <motion.div
            ref={containerRef}
            initial={false}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onKeyDown={(e) => {
                if (e.code === "Space") {
                    e.preventDefault();
                    togglePlay();
                }
            }}
            tabIndex={0}
            className={cn(
                "relative group overflow-hidden rounded-[24px] aspect-video flex items-center justify-center transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
                "bg-zinc-100 shadow-[0_20px_55px_rgba(15,23,42,0.15)] ring-1 ring-zinc-300/70",
                "dark:bg-zinc-950 dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] dark:ring-white/10",
                className
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
                    className="w-full h-full object-contain cursor-pointer"
                    onLoadStart={() => {
                        setIsLoading(true);
                        setIsError(false);
                        setProgress(0);
                        setCurrentTime(0);
                        setDuration(0);
                        setIsPlaying(autoPlay);
                        setErrorState(null);
                    }}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onCanPlay={handleCanPlay}
                    onError={handleVideoError}
                    onEnded={handleEnded}
                    onClick={togglePlay}
                    playsInline
                    preload="metadata"
                    autoPlay={autoPlay}
                />
            )}

            {/* Premium Big Center Play Button */}
            <AnimatePresence>
                {!isPlaying && !isLoading && !isError && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        onClick={togglePlay}
                        className="absolute inset-0 flex items-center justify-center bg-transparent z-20"
                    >
                        <div className="h-24 w-24 rounded-full bg-white/10 backdrop-blur-2xl border border-white/20 flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-transform active:scale-90 group-hover:scale-110">
                            <div className="h-16 w-16 rounded-full bg-purple-600/20 blur-2xl absolute animate-pulse" />
                            <Play className="h-10 w-10 text-white fill-current ml-1.5 relative z-10" />
                        </div>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Floating Glassmorphic Control Dock */}
            <AnimatePresence>
                {(isHovering || !isPlaying) && !isError && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                        className="absolute inset-x-0 bottom-6 px-6 z-30 pointer-events-none"
                    >
                        <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-[24px] border border-zinc-300/80 bg-white/92 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.2)] backdrop-blur-3xl dark:border-white/10 dark:bg-zinc-900/60 dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                            {/* Premium Continuous Seek Bar */}
                            <div className="group/seek relative h-1.5 w-full cursor-pointer rounded-full bg-zinc-200/90 transition-all hover:h-2.5 dark:bg-white/5">
                                <div
                                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 via-purple-500 to-blue-400 rounded-full transition-all duration-100 shadow-[0_0_10px_rgba(147,51,234,0.5)]"
                                    style={{ width: `${progress}%` }}
                                />
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-purple-500 bg-white opacity-0 shadow-2xl scale-75 transition-all group-hover/seek:opacity-100 group-hover/seek:scale-100"
                                    style={{ left: `${progress}%`, marginLeft: "-8px" }}
                                />
                            </div>

                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={togglePlay}
                                        className="text-zinc-700 transition-all hover:scale-110 hover:text-zinc-950 active:scale-95 dark:text-white/70 dark:hover:text-white"
                                    >
                                        {isPlaying ? (
                                            <Pause className="h-6 w-6 fill-current" />
                                        ) : (
                                            <Play className="h-6 w-6 fill-current" />
                                        )}
                                    </button>

                                    <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-600 dark:text-white/50">
                                        <span className="text-zinc-900 dark:text-white/90">{formatTime(currentTime)}</span>
                                        <span className="opacity-20 translate-y-[-1px]">|</span>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-5">
                                    <div className="group/volume flex items-center gap-3 rounded-full border border-zinc-300/75 bg-white px-3 py-1.5 transition-all hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                                        <button onClick={handleToggleMute} className="text-zinc-500 transition-all hover:text-zinc-900 dark:text-white/40 dark:hover:text-white">
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
                                            className="w-0 group-hover/volume:w-20 transition-all duration-500 h-1 accent-purple-500 cursor-pointer overflow-hidden origin-right"
                                        />
                                        <span className="hidden w-12 text-right text-[9px] font-black lowercase tracking-widest text-zinc-500 group-hover/volume:block dark:text-white/30">
                                            {volumePercent}%
                                        </span>
                                    </div>

                                    <button
                                        onClick={handleFullscreen}
                                        className="rounded-xl border border-zinc-300/75 bg-white p-2 text-zinc-600 transition-all hover:bg-zinc-100 hover:text-zinc-900 active:scale-90 dark:border-white/10 dark:bg-white/5 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                                    >
                                        <Maximize className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
