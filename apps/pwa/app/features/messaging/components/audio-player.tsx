"use client";

import React, { useEffect, useState, useRef } from "react";
import { ExternalLink, Play, Pause, RefreshCw, Volume2 } from "lucide-react";
import { cn } from "@dweb/ui-kit";
import { classifyMediaError, type MediaErrorState } from "./media-error-state";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { openNativeExternal } from "@/app/features/runtime/native-host-adapter";
import {
    formatVoiceNoteRecordedAtLabel,
    type VoiceNoteAttachmentMetadata,
} from "@/app/features/messaging/services/voice-note-metadata";

interface AudioPlayerProps {
    src: string;
    isOutgoing: boolean;
    className?: string;
    voiceNoteMetadata?: VoiceNoteAttachmentMetadata | null;
}

/**
 * Minimalist inline audio player for voice notes
 */
export function AudioPlayer({ src, isOutgoing, className, voiceNoteMetadata = null }: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [errorState, setErrorState] = useState<MediaErrorState | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [runtimeSrc, setRuntimeSrc] = useState(src);
    const [hasRetriedWithBypass, setHasRetriedWithBypass] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        setRuntimeSrc(src);
        setHasRetriedWithBypass(false);
    }, [src]);

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

    const openExternally = async () => {
        try {
            const openedNatively = await openNativeExternal(src);
            if (openedNatively) {
                return;
            }
        } catch {
            // ignore
        }

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
    const recordedAtLabel = (
        voiceNoteMetadata?.isVoiceNote && typeof voiceNoteMetadata.recordedAtUnixMs === "number"
            ? formatVoiceNoteRecordedAtLabel(voiceNoteMetadata.recordedAtUnixMs)
            : null
    );

    return (
        <div className={cn(
            "relative group flex flex-col gap-3 p-4 rounded-[24px] w-full min-w-0 overflow-hidden",
            "bg-zinc-50 border border-zinc-200/80 text-zinc-900 shadow-[0_12px_36px_rgba(15,23,42,0.12)]",
            "dark:bg-zinc-900 dark:border-white/5 dark:text-zinc-100 dark:shadow-[0_15px_40px_rgba(0,0,0,0.4)]",
            className
        )}>
            {/* Background Ambient Glow */}
            <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-purple-500/18 dark:bg-purple-600/20 blur-[40px] pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 h-16 w-16 rounded-full bg-blue-500/14 dark:bg-blue-600/10 blur-[30px] pointer-events-none" />

            <audio
                key={`${runtimeSrc}:${reloadKey}`}
                ref={audioRef}
                src={runtimeSrc}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                onError={() => {
                    const details = {
                        code: audioRef.current?.error?.code,
                        currentSrc: audioRef.current?.currentSrc,
                        readyState: audioRef.current?.readyState,
                        networkState: audioRef.current?.networkState,
                    };
                    if (!hasRetriedWithBypass) {
                        const separator = src.includes("?") ? "&" : "?";
                        setRuntimeSrc(`${src}${separator}obscur_nocache=${Date.now()}`);
                        setHasRetriedWithBypass(true);
                        return;
                    }

                    const nextError = classifyMediaError(new Error(`audio_media_error_code_${details.code ?? "unknown"}`));
                    setErrorState(nextError);
                    logRuntimeEvent(
                        `audio_player.media_error.${nextError.reasonCode}`,
                        nextError.recoverable ? "degraded" : "actionable",
                        ["[AudioPlayer] media load failed", { src, ...details }]
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
                <div className="flex w-full items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-white/40">
                    <span className="truncate">{errorState.hint}</span>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300/80 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                            onClick={() => {
                                setErrorState(null);
                                setReloadKey((prev) => prev + 1);
                                setRuntimeSrc(src);
                                setHasRetriedWithBypass(false);
                            }}
                            disabled={!errorState.canRetry}
                        >
                            <RefreshCw className="h-3 w-3" />
                            Retry
                        </button>
                    </div>
                </div>
            ) : null}

            {voiceNoteMetadata?.isVoiceNote ? (
                <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300/80">
                    <span className="inline-flex items-center rounded-md border border-purple-400/30 bg-purple-500/10 px-2 py-1 text-purple-700 dark:text-purple-300">
                        Voice Note
                    </span>
                    <span className="truncate text-right text-zinc-500 dark:text-zinc-400">
                        {recordedAtLabel ?? "Recorded recently"}
                    </span>
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
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white/90">
                            {formatTime(currentTime)}
                        </span>
                        <div className="flex items-center h-4 gap-0.5">
                            {/* Decorative Waveform Bars */}
                            {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.5].map((h, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "w-0.5 rounded-full bg-zinc-400/45 dark:bg-white/20 transition-all duration-[800ms]",
                                        isPlaying ? "animate-pulse" : ""
                                    )}
                                    style={{ height: `${h * 100}%`, animationDelay: `${i * 100}ms` }}
                                />
                            ))}
                        </div>
                        <span className="text-[11px] font-bold text-zinc-600 dark:text-white/40">
                            {formatTime(duration)}
                        </span>
                    </div>

                    {/* Premium Progress Bar */}
                    <div className="relative h-2 w-full bg-zinc-200/90 dark:bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Row Controls */}
            <div className="flex items-center justify-between mt-1 px-1 border-t border-zinc-200/90 dark:border-white/5 pt-3">
                <div className="flex items-center gap-2 group-hover:opacity-100 opacity-80 dark:opacity-65 transition-opacity">
                    <Volume2 className="h-3 w-3 text-zinc-600 dark:text-white/50" />
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
                    <span className="text-[9px] font-black tracking-widest text-zinc-500 dark:text-white/30 lowercase">
                        vol {volumePercent}%
                    </span>
                </div>

                <button
                    onClick={openExternally}
                    className="p-1.5 rounded-lg border border-zinc-300/70 bg-white hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition-all shadow-sm active:scale-95 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/50 dark:hover:text-white"
                    title="Open Externally"
                >
                    <ExternalLink className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );

}
