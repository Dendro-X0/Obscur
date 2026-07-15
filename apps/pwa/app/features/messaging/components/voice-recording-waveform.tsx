"use client";

import React, { useId, useMemo } from "react";
import { cn } from "@dweb/ui-kit";
import { buildRecordingWavePath } from "@/app/features/messaging/services/voice-recording-waveform-level";
import type { VoiceRecordingWaveformState } from "@/app/features/messaging/hooks/use-voice-recording-waveform";

const VIEW_WIDTH = 168;
const VIEW_HEIGHT = 28;

export function VoiceRecordingWaveform(props: Readonly<{
  waveform: VoiceRecordingWaveformState;
  className?: string;
}>): React.JSX.Element {
  const gradientId = useId();
  const glowId = useId();

  const wavePath = useMemo(() => buildRecordingWavePath({
    points: props.waveform.points,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    retract: props.waveform.retract,
  }), [props.waveform.points, props.waveform.retract]);

  const leadingEnergy = props.waveform.points[props.waveform.points.length - 1] ?? 0;
  const strokeOpacity = 0.45 + (props.waveform.intensity * 0.4);
  const spectralShift = props.waveform.spectralBlend;

  return (
    <div
      className={cn(
        "relative flex flex-1 items-center justify-center min-w-[112px] max-w-[168px] h-7 overflow-hidden",
        props.className,
      )}
      aria-hidden="true"
    >
      <div
        className="pointer-events-none absolute inset-y-1 left-0 w-8 bg-gradient-to-r from-purple-50/95 via-purple-50/40 to-transparent dark:from-zinc-900/95 dark:via-zinc-900/40"
      />
      <div
        className="pointer-events-none absolute inset-y-1 right-0 w-10 bg-gradient-to-l from-white via-white/70 to-transparent dark:from-zinc-900 dark:via-zinc-900/70"
      />

      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="h-full w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(192 132 252 / 0.15)" />
            <stop offset={`${Math.max(35, 100 - (spectralShift * 40)).toFixed(0)}%`} stopColor="rgb(168 85 247 / 0.85)" />
            <stop offset="100%" stopColor="rgb(217 70 239 / 0.95)" />
          </linearGradient>
          <linearGradient id={glowId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(168 85 247 / 0)" />
            <stop offset="78%" stopColor="rgb(168 85 247 / 0)" />
            <stop offset="100%" stopColor={`rgb(244 114 182 / ${0.25 + (leadingEnergy * 0.45)})`} />
          </linearGradient>
        </defs>

        <path
          d={wavePath}
          fill={`url(#${gradientId})`}
          opacity={0.55 + (props.waveform.retract * 0.35)}
          className="transition-opacity duration-100"
        />
        <path
          d={wavePath}
          fill="none"
          stroke={`url(#${glowId})`}
          strokeWidth="1.25"
          strokeLinejoin="round"
          opacity={strokeOpacity}
        />
      </svg>
    </div>
  );
}
