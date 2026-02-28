"use client";

import React, { useState, useRef } from "react";
import { Play, Pause, Volume2, Maximize, Loader2, VideoOff, ExternalLink } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import { cn } from "@dweb/ui-kit";

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
    const [errorHint, setErrorHint] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const openExternally = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        try {
            const isDesktop = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
            if (isDesktop) {
                const { open } = await import("@tauri-apps/plugin-shell");
                await open(src);
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
        setErrorHint(null);
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
        console.error("[VideoPlayer] media error", details);

        const hint = err?.code ? `MediaError code ${err.code}` : "MediaError";
        setErrorHint(hint);
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

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative group overflow-hidden rounded-2xl bg-black aspect-video flex items-center justify-center shadow-2xl transition-all duration-500",
                isOutgoing ? "ring-1 ring-purple-500/10" : "ring-1 ring-black/5 dark:ring-white/5",
                className
            )}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
            )}

            {isError ? (
                <div className="flex flex-col items-center justify-center gap-3 text-zinc-500 p-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-zinc-900 flex items-center justify-center">
                        <VideoOff className="h-8 w-8" />
                    </div>
                    <div>
                        <div className="text-xs font-black uppercase tracking-widest text-zinc-400">Load Failed</div>
                        {errorHint ? (
                            <div className="text-[10px] mt-1 opacity-60 max-w-[200px] truncate">{errorHint}</div>
                        ) : null}
                        <div className="text-[10px] mt-1 opacity-60 max-w-[200px] truncate">{src}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] uppercase font-bold tracking-tighter hover:bg-white/5"
                            onClick={() => {
                                setIsError(false);
                                setIsLoading(true);
                                setErrorHint(null);
                                if (videoRef.current) {
                                    videoRef.current.load();
                                }
                            }}
                        >
                            Retry
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] uppercase font-bold tracking-tighter hover:bg-white/5"
                            onClick={openExternally}
                        >
                            <ExternalLink className="h-3 w-3" />
                            Open
                        </Button>
                    </div>
                </div>
            ) : (
                <video
                    key={src}
                    ref={videoRef}
                    src={src}
                    className="w-full h-full object-contain cursor-pointer"
                    onLoadStart={() => {
                        setIsLoading(true);
                        setIsError(false);
                        setProgress(0);
                        setCurrentTime(0);
                        setDuration(0);
                        setIsPlaying(autoPlay);
                        setErrorHint(null);
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

            {/* Premium Overlay Controls (only show if not error) */}
            {!isError && (
                <div className={cn(
                    "absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 pointer-events-none",
                    (isHovering || !isPlaying) ? "opacity-100" : "opacity-0"
                )}>
                    <div className="flex flex-col gap-3 pointer-events-auto">
                        {/* Progress Bar */}
                        <div className="relative h-1.5 w-full bg-white/20 rounded-full overflow-hidden cursor-pointer">
                            <div
                                className="absolute top-0 left-0 h-full bg-purple-500 rounded-full transition-all duration-100"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={togglePlay}
                                    className="p-1 hover:text-purple-400 text-white transition-colors active:scale-90"
                                >
                                    {isPlaying ? (
                                        <Pause className="h-5 w-5 fill-current" />
                                    ) : (
                                        <Play className="h-5 w-5 fill-current" />
                                    )}
                                </button>

                                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/80 mono">
                                    <span>{formatTime(currentTime)}</span>
                                    <span className="opacity-40">/</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Volume2 className="h-4 w-4 text-white/60" />
                                <button
                                    onClick={handleFullscreen}
                                    className="p-1 hover:text-purple-400 text-white transition-colors"
                                >
                                    <Maximize className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Big Play Button if not playing */}
            {!isPlaying && !isLoading && !isError && (
                <button
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors z-20"
                >
                    <div className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center transition-transform group-hover:scale-110">
                        <Play className="h-8 w-8 text-white fill-current ml-1" />
                    </div>
                </button>
            )}
        </div>
    );
}
