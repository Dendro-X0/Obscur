"use client";

import React, { useState, useRef } from "react";
import { ExternalLink, Play, Pause, RefreshCw, Volume2 } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import { cn } from "@dweb/ui-kit";
import { classifyMediaError, type MediaErrorState } from "./media-error-state";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";

interface AudioPlayerProps {
    src: string;
    isOutgoing: boolean;
    className?: string;
}

/**
 * Minimalist inline audio player for voice notes
 */
export function AudioPlayer({ src, isOutgoing, className }: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [errorState, setErrorState] = useState<MediaErrorState | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
    };

    const openExternally = () => {
        if (typeof window === "undefined") return;
        window.open(src, "_blank", "noopener,noreferrer");
    };

    const handleToggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;
        const nextMuted = !audio.muted;
        audio.muted = nextMuted;
        setIsMuted(nextMuted);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;
        const nextVolume = Math.max(0, Math.min(1, Number(e.target.value)));
        audio.volume = nextVolume;
        const nextMuted = nextVolume === 0;
        audio.muted = nextMuted;
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
        <div className={cn(
            "flex items-center gap-3 p-3 rounded-2xl w-full min-w-0",
            isOutgoing
                ? "bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 shadow-lg"
                : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
            className
        )}>
            <audio
                key={`${src}:${reloadKey}`}
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                onError={() => {
                    const nextError = classifyMediaError(new Error("audio_load_failed"));
                    setErrorState(nextError);
                    logRuntimeEvent(
                        `audio_player.media_error.${nextError.reasonCode}`,
                        nextError.recoverable ? "degraded" : "actionable",
                        ["[AudioPlayer] media load failed", { src }]
                    );
                }}
                onVolumeChange={() => {
                    const audio = audioRef.current;
                    if (!audio) return;
                    setVolume(audio.volume);
                    setIsMuted(audio.muted);
                }}
            />

            {errorState ? (
                <div className="flex w-full items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest opacity-80">
                    <span className="truncate">{errorState.hint}</span>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                            onClick={() => {
                                setErrorState(null);
                                setReloadKey((prev) => prev + 1);
                            }}
                            disabled={!errorState.canRetry}
                        >
                            <RefreshCw className="h-3 w-3" />
                            Retry
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                            onClick={openExternally}
                            disabled={!errorState.canOpenExternal}
                        >
                            <ExternalLink className="h-3 w-3" />
                            Open
                        </button>
                    </div>
                </div>
            ) : null}

            <Button
                size="icon"
                className={cn(
                    "h-9 w-9 rounded-full shrink-0 shadow-md transition-transform active:scale-95",
                    isOutgoing
                        ? "bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                        : "bg-white text-purple-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-purple-400 dark:hover:bg-zinc-900/80"
                )}
                onClick={togglePlay}
            >
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
            </Button>

            <div className="flex-1 space-y-1.5">
                <div className="relative h-1.5 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "absolute top-0 left-0 h-full transition-all duration-150 rounded-full",
                            isOutgoing ? "bg-white dark:bg-zinc-900" : "bg-purple-500"
                        )}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-60">
                    <span>{formatTime(currentTime)}</span>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleToggleMute}
                            className="opacity-80 hover:opacity-100 transition-opacity"
                            aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                        >
                            <Volume2 className="h-2.5 w-2.5" />
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-16 accent-purple-500 cursor-pointer"
                            aria-label="Audio volume"
                        />
                        <span
                            className="text-[9px] font-black tracking-wider opacity-70"
                            title={`Volume ${volumePercent}%`}
                        >
                            Volume {volumePercent}%
                        </span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
