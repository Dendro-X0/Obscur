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
            "relative group flex flex-col gap-3 p-4 rounded-[24px] w-full min-w-0 overflow-hidden",
            "bg-zinc-900 border border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.4)]",
            className
        )}>
            {/* Background Ambient Glow */}
            <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-purple-600/20 blur-[40px] pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 h-16 w-16 rounded-full bg-blue-600/10 blur-[30px] pointer-events-none" />

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
                <div className="flex w-full items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest text-white/40">
                    <span className="truncate">{errorState.hint}</span>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 bg-white/5 hover:bg-white/10"
                            onClick={() => {
                                setErrorState(null);
                                setReloadKey((prev) => prev + 1);
                            }}
                            disabled={!errorState.canRetry}
                        >
                            <RefreshCw className="h-3 w-3" />
                            Retry
                        </button>
                    </div>
                </div>
            ) : null}

            <div className="flex items-center gap-4">
                <button
                    type="button"
                    className={cn(
                        "h-12 w-12 flex items-center justify-center rounded-full shrink-0 shadow-lg transition-all active:scale-90",
                        "bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-purple-500/20 hover:scale-105"
                    )}
                    onClick={togglePlay}
                >
                    {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90">
                            {formatTime(currentTime)}
                        </span>
                        <div className="flex items-center h-4 gap-0.5">
                            {/* Decorative Waveform Bars */}
                            {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.5].map((h, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "w-0.5 rounded-full bg-white/20 transition-all duration-[800ms]",
                                        isPlaying ? "animate-pulse" : ""
                                    )}
                                    style={{ height: `${h * 100}%`, animationDelay: `${i * 100}ms` }}
                                />
                            ))}
                        </div>
                        <span className="text-[11px] font-bold text-white/40">
                            {formatTime(duration)}
                        </span>
                    </div>

                    {/* Premium Progress Bar */}
                    <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Row Controls */}
            <div className="flex items-center justify-between mt-1 px-1 border-t border-white/5 pt-3">
                <div className="flex items-center gap-2 group-hover:opacity-100 opacity-60 transition-opacity">
                    <Volume2 className="h-3 w-3 text-white/50" />
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 accent-purple-500 cursor-pointer h-1"
                        aria-label="Audio volume"
                    />
                    <span className="text-[9px] font-black tracking-widest text-white/30 lowercase">
                        vol {volumePercent}%
                    </span>
                </div>

                <button
                    onClick={openExternally}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all shadow-sm active:scale-95"
                    title="Open Externally"
                >
                    <ExternalLink className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );

}
