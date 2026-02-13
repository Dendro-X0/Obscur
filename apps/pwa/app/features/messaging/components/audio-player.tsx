"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/cn";

interface AudioPlayerProps {
    src: string;
    isOutgoing: boolean;
}

/**
 * Minimalist inline audio player for voice notes
 */
export function AudioPlayer({ src, isOutgoing }: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
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

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className={cn(
            "flex items-center gap-3 p-3 rounded-2xl min-w-[200px] max-w-[280px]",
            isOutgoing
                ? "bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 shadow-lg"
                : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        )}>
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
            />

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
                    <div className="flex items-center gap-1 group">
                        <Volume2 className="h-2.5 w-2.5" />
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
