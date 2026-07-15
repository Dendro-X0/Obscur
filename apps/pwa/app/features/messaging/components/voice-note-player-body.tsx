"use client";

import React from "react";
import { Pause, Play, RefreshCw } from "lucide-react";
import { cn } from "@dweb/ui-kit";
import type { VoiceNotePlaybackState } from "@/app/features/messaging/hooks/use-voice-note-playback";
import { VoicePlaybackWaveform } from "./voice-playback-waveform";

export function VoiceNotePlayerBody(props: Readonly<{
  playback: VoiceNotePlaybackState;
  isOutgoing: boolean;
  waveformClassName?: string;
  playButtonClassName?: string;
  timeClassName?: string;
  errorClassName?: string;
}>): React.JSX.Element {
  if (props.playback.hasError) {
    return (
      <div className={cn(
        "flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest",
        props.isOutgoing
          ? "bg-white/10 text-white/90"
          : "border border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        props.errorClassName,
      )}>
        <span className="truncate">Playback unavailable</span>
        <button
          type="button"
          onClick={props.playback.retry}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5",
            props.isOutgoing
              ? "bg-white/15 hover:bg-white/25"
              : "border border-rose-400/30",
          )}
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { void props.playback.togglePlay(); }}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95",
          props.isOutgoing
            ? "bg-white/18 text-white hover:bg-white/28 backdrop-blur-sm"
            : "bg-gradient-to-br from-purple-600 to-indigo-500 text-white hover:from-purple-500 hover:to-indigo-400 shadow-[0_0_16px_rgba(168,85,247,0.25)]",
          props.playButtonClassName,
        )}
        aria-label={props.playback.isPlaying ? "Pause voice note" : "Play voice note"}
      >
        {props.playback.isPlaying
          ? <Pause className="h-4 w-4" />
          : <Play className="h-4 w-4 translate-x-[1px]" />}
      </button>

      <VoicePlaybackWaveform
        peaks={props.playback.peaks}
        progressPercent={props.playback.progressPercent}
        isOutgoing={props.isOutgoing}
        onSeekPercent={props.playback.seekToPercent}
        ariaLabel="Voice note progress"
        className={cn(
          props.playback.peaksReady ? undefined : "opacity-60",
          props.waveformClassName,
        )}
      />

      <span className={cn(
        "min-w-[2.5rem] shrink-0 text-right text-xs font-semibold tabular-nums",
        props.isOutgoing ? "text-white/90" : "text-zinc-600 dark:text-zinc-300",
        props.timeClassName,
      )}>
        {props.playback.timeLabel}
      </span>
    </>
  );
}
