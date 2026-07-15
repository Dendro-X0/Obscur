"use client";

import React from "react";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import type { VoiceNoteAttachmentMetadata } from "@/app/features/messaging/services/voice-note-metadata";
import {
  createFallbackVoicePlaybackPeaks,
  decodeVoicePlaybackPeaks,
  resolveVoicePlaybackProgressPercent,
} from "@/app/features/messaging/services/voice-playback-peaks";

const formatVoiceTime = (secondsInput: number): string => {
  const seconds = Number.isFinite(secondsInput) ? Math.max(0, Math.floor(secondsInput)) : 0;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

export type VoiceNotePlaybackState = Readonly<{
  audioRef: React.RefObject<HTMLAudioElement | null>;
  runtimeSrc: string;
  peaks: ReadonlyArray<number>;
  peaksReady: boolean;
  isPlaying: boolean;
  hasError: boolean;
  progressPercent: number;
  timeLabel: string;
  durationSeconds: number;
  currentTimeSeconds: number;
  volume: number;
  isMuted: boolean;
  togglePlay: () => Promise<void>;
  seekToPercent: (nextPercent: number) => void;
  setVolume: (nextVolume: number) => void;
  toggleMute: () => void;
  retry: () => void;
  audioProps: React.AudioHTMLAttributes<HTMLAudioElement>;
}>;

export function useVoiceNotePlayback(params: Readonly<{
  src: string;
  voiceNoteMetadata?: VoiceNoteAttachmentMetadata | null;
}>): VoiceNotePlaybackState {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [runtimeSrc, setRuntimeSrc] = React.useState(params.src);
  const [hasRetriedWithBypass, setHasRetriedWithBypass] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTimeSeconds, setCurrentTimeSeconds] = React.useState(0);
  const [durationSeconds, setDurationSeconds] = React.useState(0);
  const [peaks, setPeaks] = React.useState<ReadonlyArray<number>>(
    () => createFallbackVoicePlaybackPeaks(),
  );
  const [peaksReady, setPeaksReady] = React.useState(false);
  const [volume, setVolumeState] = React.useState(1);
  const [isMuted, setIsMuted] = React.useState(false);

  const fallbackDurationSeconds = (
    params.voiceNoteMetadata?.isVoiceNote
    && typeof params.voiceNoteMetadata.durationSeconds === "number"
      ? params.voiceNoteMetadata.durationSeconds
      : 0
  );
  const effectiveDurationSeconds = durationSeconds > 0 ? durationSeconds : fallbackDurationSeconds;
  const progressPercent = resolveVoicePlaybackProgressPercent(
    currentTimeSeconds,
    effectiveDurationSeconds,
  );
  const timeLabel = (
    isPlaying || currentTimeSeconds > 0
      ? formatVoiceTime(currentTimeSeconds)
      : formatVoiceTime(effectiveDurationSeconds)
  );

  React.useEffect(() => {
    setRuntimeSrc(params.src);
    setHasRetriedWithBypass(false);
    setHasError(false);
    setIsPlaying(false);
    setCurrentTimeSeconds(0);
    setDurationSeconds(0);
    setPeaksReady(false);
    setPeaks(createFallbackVoicePlaybackPeaks());
    setVolumeState(1);
    setIsMuted(false);
  }, [params.src]);

  React.useEffect(() => {
    let cancelled = false;
    setPeaksReady(false);
    void decodeVoicePlaybackPeaks(runtimeSrc).then((nextPeaks) => {
      if (!cancelled) {
        setPeaks(nextPeaks);
        setPeaksReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [runtimeSrc]);

  const handleMediaError = React.useCallback((): void => {
    if (!hasRetriedWithBypass) {
      const separator = params.src.includes("?") ? "&" : "?";
      setRuntimeSrc(`${params.src}${separator}obscur_nocache=${Date.now()}`);
      setHasRetriedWithBypass(true);
      return;
    }
    setHasError(true);
    logRuntimeEvent(
      "voice_note_player.media_error",
      "degraded",
      ["[VoiceNotePlayer] media load failed", { src: params.src }],
    );
  }, [hasRetriedWithBypass, params.src]);

  const togglePlay = React.useCallback(async (): Promise<void> => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      }
      catch {
        setIsPlaying(false);
      }
      return;
    }
    audio.pause();
    setIsPlaying(false);
  }, []);

  const seekToPercent = React.useCallback((nextPercent: number): void => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(effectiveDurationSeconds) || effectiveDurationSeconds <= 0) {
      return;
    }
    const clamped = Math.max(0, Math.min(100, nextPercent));
    const nextTime = (clamped / 100) * effectiveDurationSeconds;
    audio.currentTime = nextTime;
    setCurrentTimeSeconds(nextTime);
  }, [effectiveDurationSeconds]);

  const setVolume = React.useCallback((nextVolumeInput: number): void => {
    const audio = audioRef.current;
    const nextVolume = Math.max(0, Math.min(1, nextVolumeInput));
    if (audio) {
      audio.volume = nextVolume;
      audio.muted = nextVolume === 0;
    }
    setVolumeState(nextVolume);
    setIsMuted(nextVolume === 0);
  }, []);

  const toggleMute = React.useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const nextMuted = !audio.muted;
    audio.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  const retry = React.useCallback((): void => {
    setHasError(false);
    setHasRetriedWithBypass(false);
    setRuntimeSrc(params.src);
  }, [params.src]);

  const audioProps = React.useMemo<React.AudioHTMLAttributes<HTMLAudioElement>>(() => ({
    src: runtimeSrc,
    preload: "metadata",
    onTimeUpdate: () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      setCurrentTimeSeconds(audio.currentTime);
    },
    onLoadedMetadata: () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      setDurationSeconds(Number.isFinite(audio.duration) ? audio.duration : 0);
    },
    onPause: () => setIsPlaying(false),
    onPlay: () => setIsPlaying(true),
    onEnded: () => {
      setIsPlaying(false);
      setCurrentTimeSeconds(0);
    },
    onVolumeChange: () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      setVolumeState(audio.volume);
      setIsMuted(audio.muted);
    },
    onError: handleMediaError,
  }), [handleMediaError, runtimeSrc]);

  return {
    audioRef,
    runtimeSrc,
    peaks,
    peaksReady,
    isPlaying,
    hasError,
    progressPercent,
    timeLabel,
    durationSeconds: effectiveDurationSeconds,
    currentTimeSeconds,
    volume,
    isMuted,
    togglePlay,
    seekToPercent,
    setVolume,
    toggleMute,
    retry,
    audioProps,
  };
}
