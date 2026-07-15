"use client";

import React from "react";
import { cn } from "@dweb/ui-kit";
import {
  resolveVoicePlaybackSeekPercent,
} from "@/app/features/messaging/services/voice-playback-peaks";

const MIN_BAR_HEIGHT_PERCENT = 22;

const resolvePeakTone = (isOutgoing: boolean, isPlayed: boolean): string => {
  if (isOutgoing) {
    return isPlayed ? "bg-white/90" : "bg-white/35";
  }
  return isPlayed
    ? "bg-gradient-to-b from-purple-600 via-purple-500 to-fuchsia-400 opacity-95"
    : "bg-purple-400/35 dark:bg-purple-300/25";
};

export function VoicePlaybackWaveform(props: Readonly<{
  peaks: ReadonlyArray<number>;
  progressPercent: number;
  isOutgoing: boolean;
  ariaLabel?: string;
  onSeekPercent: (nextPercent: number) => void;
  className?: string;
}>): React.JSX.Element {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isDraggingRef = React.useRef(false);

  const applySeekFromClientX = React.useCallback((clientX: number): void => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }
    props.onSeekPercent(resolveVoicePlaybackSeekPercent(clientX, bounds));
  }, [props.onSeekPercent]);

  React.useEffect(() => {
    const stopDragging = (): void => {
      isDraggingRef.current = false;
    };
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  const playedCutoff = props.progressPercent;

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label={props.ariaLabel ?? "Voice note progress"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(props.progressPercent)}
      tabIndex={0}
      className={cn(
        "relative flex min-w-0 flex-1 items-stretch gap-px h-8 w-full overflow-hidden cursor-pointer touch-none select-none",
        props.className,
      )}
      onPointerDown={(event) => {
        isDraggingRef.current = true;
        containerRef.current?.setPointerCapture(event.pointerId);
        applySeekFromClientX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!isDraggingRef.current) {
          return;
        }
        applySeekFromClientX(event.clientX);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          props.onSeekPercent(Math.min(100, props.progressPercent + 2));
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          props.onSeekPercent(Math.max(0, props.progressPercent - 2));
        }
      }}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2",
          props.isOutgoing ? "bg-white/20" : "bg-purple-500/15 dark:bg-purple-300/20",
        )}
      />

      {props.peaks.map((peak, index) => {
        const positionPercent = props.peaks.length <= 1
          ? 0
          : (index / (props.peaks.length - 1)) * 100;
        const isPlayed = positionPercent <= playedCutoff + 0.001;
        const amplitude = MIN_BAR_HEIGHT_PERCENT + (peak * (100 - MIN_BAR_HEIGHT_PERCENT));
        const halfHeight = amplitude / 2;
        const tone = resolvePeakTone(props.isOutgoing, isPlayed);

        return (
          <div
            key={`voice-playback-peak-${index}`}
            className="relative z-[1] flex h-full min-w-0 flex-1 flex-col items-stretch justify-center"
          >
            <div className="flex min-h-0 flex-1 items-end">
              <span
                className={cn(
                  "w-full min-h-[1px] rounded-t-full transition-[height,opacity,background-color] duration-100",
                  tone,
                )}
                style={{ height: `${halfHeight}%` }}
              />
            </div>
            <div className="flex min-h-0 flex-1 items-start">
              <span
                className={cn(
                  "w-full min-h-[1px] rounded-b-full transition-[height,opacity,background-color] duration-100",
                  tone,
                )}
                style={{ height: `${halfHeight}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
