"use client";

import React from "react";
import { ExternalLink, Pause, Play, RefreshCw } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { openNativeExternal } from "@/app/features/runtime/native-host-adapter";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import {
    formatVoiceNoteRecordedAtLabel,
    type VoiceNoteAttachmentMetadata,
} from "@/app/features/messaging/services/voice-note-metadata";

type VoiceNoteCardProps = Readonly<{
    src: string;
    isOutgoing: boolean;
    voiceNoteMetadata?: VoiceNoteAttachmentMetadata | null;
    className?: string;
}>;

const formatTime = (secondsInput: number): string => {
    const seconds = Number.isFinite(secondsInput) ? Math.max(0, secondsInput) : 0;
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

export function VoiceNoteCard({
    src,
    isOutgoing,
    voiceNoteMetadata = null,
    className,
}: VoiceNoteCardProps) {
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [currentTimeSeconds, setCurrentTimeSeconds] = React.useState(0);
    const [durationSeconds, setDurationSeconds] = React.useState(0);
    const [runtimeSrc, setRuntimeSrc] = React.useState(src);
    const [hasRetriedWithBypass, setHasRetriedWithBypass] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);

    React.useEffect(() => {
        setRuntimeSrc(src);
        setHasRetriedWithBypass(false);
        setHasError(false);
        setIsPlaying(false);
        setCurrentTimeSeconds(0);
        setDurationSeconds(0);
    }, [src]);

    const togglePlay = React.useCallback(async (): Promise<void> => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }
        if (audio.paused) {
            try {
                await audio.play();
                setIsPlaying(true);
            } catch {
                setIsPlaying(false);
            }
            return;
        }
        audio.pause();
        setIsPlaying(false);
    }, []);

    const handleSeek = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
        const audio = audioRef.current;
        if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
            return;
        }
        const nextPercent = Number(event.target.value);
        const nextTime = (nextPercent / 100) * audio.duration;
        audio.currentTime = nextTime;
        setCurrentTimeSeconds(nextTime);
    }, []);

    const handleOpenExternally = React.useCallback(async (): Promise<void> => {
        try {
            const openedNatively = await openNativeExternal(src);
            if (openedNatively) {
                return;
            }
        } catch {
            // Fall back to browser open below.
        }

        if (typeof window !== "undefined") {
            window.open(src, "_blank", "noopener,noreferrer");
        }
    }, [src]);

    const handleRetry = React.useCallback((): void => {
        setHasError(false);
        setHasRetriedWithBypass(false);
        setRuntimeSrc(src);
    }, [src]);

    const recordedAtLabel = (
        voiceNoteMetadata?.isVoiceNote && typeof voiceNoteMetadata.recordedAtUnixMs === "number"
            ? formatVoiceNoteRecordedAtLabel(voiceNoteMetadata.recordedAtUnixMs)
            : null
    );
    const fallbackDurationSeconds = (
        voiceNoteMetadata?.isVoiceNote && typeof voiceNoteMetadata.durationSeconds === "number"
            ? voiceNoteMetadata.durationSeconds
            : 0
    );
    const effectiveDurationSeconds = durationSeconds > 0 ? durationSeconds : fallbackDurationSeconds;
    const progressPercent = effectiveDurationSeconds > 0
        ? Math.min(100, (currentTimeSeconds / effectiveDurationSeconds) * 100)
        : 0;

    return (
        <div
            className={cn(
                "rounded-2xl border border-surface-contrast px-3 py-2.5",
                "bg-gradient-surface-contrast text-surface-contrast-primary shadow-[0_12px_30px_rgba(15,23,42,0.14)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.46)]",
                isOutgoing ? "ring-1 ring-purple-400/20 dark:ring-purple-400/15" : "",
                className,
            )}
        >
            <audio
                ref={audioRef}
                src={runtimeSrc}
                preload="metadata"
                onTimeUpdate={() => {
                    const audio = audioRef.current;
                    if (!audio) {
                        return;
                    }
                    setCurrentTimeSeconds(audio.currentTime);
                }}
                onLoadedMetadata={() => {
                    const audio = audioRef.current;
                    if (!audio) {
                        return;
                    }
                    setDurationSeconds(Number.isFinite(audio.duration) ? audio.duration : 0);
                }}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTimeSeconds(0);
                }}
                onError={() => {
                    if (!hasRetriedWithBypass) {
                        const separator = src.includes("?") ? "&" : "?";
                        setRuntimeSrc(`${src}${separator}obscur_nocache=${Date.now()}`);
                        setHasRetriedWithBypass(true);
                        return;
                    }
                    setHasError(true);
                    logRuntimeEvent(
                        "voice_note_card.media_error",
                        "degraded",
                        ["[VoiceNoteCard] media load failed", { src }]
                    );
                }}
            />

            <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5">
                    <span className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]",
                        isOutgoing
                            ? "border-purple-300/45 bg-purple-500/22 text-purple-900 dark:text-purple-100"
                            : "border-purple-300/60 bg-purple-500/10 text-purple-700 dark:border-purple-400/40 dark:bg-purple-500/15 dark:text-purple-300",
                    )}>
                        Voice Note
                    </span>
                    {voiceNoteMetadata?.durationLabel ? (
                        <span className="text-[10px] font-black tracking-widest opacity-70">
                            {voiceNoteMetadata.durationLabel}
                        </span>
                    ) : null}
                </div>
                <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] opacity-65">
                    {recordedAtLabel ?? "Recorded recently"}
                </span>
            </div>

            <div className="mb-2 min-w-0">
                <div className="truncate text-xs font-bold">Voice Notes</div>
            </div>

            {hasError ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-rose-700 dark:text-rose-300">
                    <span className="truncate">Playback unavailable</span>
                    <button
                        type="button"
                        onClick={handleRetry}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-400/30 px-2 py-0.5 text-[10px]"
                    >
                        <RefreshCw className="h-3 w-3" />
                        Retry
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => { void togglePlay(); }}
                        className={cn(
                            "h-10 w-10 shrink-0 rounded-full transition active:scale-95",
                            isOutgoing
                                ? "bg-purple-600 text-white hover:bg-purple-500 dark:bg-purple-500 dark:hover:bg-purple-400"
                                : "bg-purple-600 text-white hover:bg-purple-500 dark:bg-purple-500 dark:hover:bg-purple-400",
                        )}
                        aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
                    >
                        {isPlaying ? <Pause className="mx-auto h-4 w-4" /> : <Play className="mx-auto h-4 w-4" />}
                    </button>

                    <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between text-[10px] font-black tracking-widest opacity-80">
                            <span>{formatTime(currentTimeSeconds)}</span>
                            <span>{formatTime(effectiveDurationSeconds)}</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={progressPercent}
                            onChange={handleSeek}
                            className="h-1.5 w-full cursor-pointer accent-purple-500"
                            aria-label="Voice note progress"
                        />
                        <div className="mt-1 flex items-center gap-[3px]">
                            {Array.from({ length: 18 }).map((_, index) => (
                                <span
                                    key={`voice-wave-${index}`}
                                    className={cn(
                                        "inline-block w-[2px] rounded-full",
                                        isOutgoing ? "bg-white/35" : "bg-zinc-500/35 dark:bg-white/25",
                                        isPlaying ? "animate-pulse" : ""
                                    )}
                                    style={{
                                        height: `${6 + ((index * 7) % 11)}px`,
                                        animationDelay: `${index * 60}ms`,
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => { void handleOpenExternally(); }}
                        className={cn(
                            "h-8 w-8 shrink-0 rounded-lg border transition active:scale-95",
                            isOutgoing
                                ? "border-zinc-400/60 bg-white/40 hover:bg-white/65 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
                                : "border-zinc-400/60 bg-white/40 hover:bg-white/65 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10",
                        )}
                        aria-label="Open voice note in new tab"
                    >
                        <ExternalLink className="mx-auto h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
