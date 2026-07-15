"use client";

import { useEffect, useState } from "react";
import {
  advanceRecordingWaveformPoints,
  createIdleRecordingWaveformPoints,
  RECORDING_WAVEFORM_POINT_COUNT,
  resolveRecordingWaveRetractFactor,
  sampleRecordingWaveformFrame,
  smoothRecordingWaveformRetract,
  type RecordingWaveformFrame,
} from "@/app/features/messaging/services/voice-recording-waveform-level";

export type VoiceRecordingWaveformState = Readonly<{
  points: ReadonlyArray<number>;
  retract: number;
  intensity: number;
  spectralBlend: number;
}>;

const createIdleWaveformState = (): VoiceRecordingWaveformState => ({
  points: createIdleRecordingWaveformPoints(),
  retract: 0.08,
  intensity: 0,
  spectralBlend: 0,
});

const resolveAudioContextCtor = (): typeof AudioContext | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
};

const applyWaveformFrame = (
  current: VoiceRecordingWaveformState,
  frame: RecordingWaveformFrame,
): VoiceRecordingWaveformState => {
  const retractTarget = resolveRecordingWaveRetractFactor(frame.intensity, frame.spectralBlend);
  return {
    points: advanceRecordingWaveformPoints(current.points, frame.sample),
    retract: smoothRecordingWaveformRetract(current.retract, retractTarget),
    intensity: frame.intensity,
    spectralBlend: frame.spectralBlend,
  };
};

export function useVoiceRecordingWaveform(
  stream: MediaStream | null,
  isActive: boolean,
): VoiceRecordingWaveformState {
  const [state, setState] = useState<VoiceRecordingWaveformState>(createIdleWaveformState);

  useEffect(() => {
    if (!isActive || !stream || stream.getAudioTracks().length === 0) {
      setState(createIdleWaveformState());
      return;
    }

    const AudioContextCtor = resolveAudioContextCtor();
    if (!AudioContextCtor) {
      return;
    }

    let disposed = false;
    let animationFrameId: number | null = null;
    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.68;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    source.connect(analyser);
    const timeDomainBuffer = new Uint8Array(analyser.fftSize);
    const frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);

    const tick = (): void => {
      if (disposed) {
        return;
      }
      const frame = sampleRecordingWaveformFrame(analyser, timeDomainBuffer, frequencyBuffer);
      setState((current) => applyWaveformFrame(current, frame));
      animationFrameId = window.requestAnimationFrame(tick);
    };

    const start = async (): Promise<void> => {
      try {
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
      }
      catch {
        // Best effort — waveform is decorative.
      }
      if (!disposed) {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    void start();

    return () => {
      disposed = true;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      try {
        source.disconnect();
      }
      catch {
        // Best effort.
      }
      try {
        analyser.disconnect();
      }
      catch {
        // Best effort.
      }
      void audioContext.close();
      setState(createIdleWaveformState());
    };
  }, [isActive, stream]);

  return state.points.length === RECORDING_WAVEFORM_POINT_COUNT
    ? state
    : createIdleWaveformState();
}
