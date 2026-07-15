export const VOICE_PLAYBACK_PEAK_COUNT = 56;

const clampLevel = (value: number): number => Math.max(0, Math.min(1, value));

export const normalizeVoicePlaybackPeaks = (
  peaks: ReadonlyArray<number>,
  peakCount: number = VOICE_PLAYBACK_PEAK_COUNT,
): ReadonlyArray<number> => {
  if (peaks.length === 0) {
    return createFallbackVoicePlaybackPeaks(peakCount, "empty");
  }

  const maxPeak = peaks.reduce((max, peak) => Math.max(max, peak), 0);
  const normalized = peaks.map((peak) => (
    maxPeak > 0 ? clampLevel(peak / maxPeak) : 0
  ));

  if (normalized.length === peakCount) {
    return normalized;
  }

  if (normalized.length > peakCount) {
    const bucketSize = normalized.length / peakCount;
    return Array.from({ length: peakCount }, (_, index) => {
      const start = Math.floor(index * bucketSize);
      const end = Math.floor((index + 1) * bucketSize);
      let max = 0;
      for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
        max = Math.max(max, normalized[sampleIndex] ?? 0);
      }
      return clampLevel(max);
    });
  }

  const padded = [...normalized];
  while (padded.length < peakCount) {
    padded.push(padded[padded.length - 1] ?? 0);
  }
  return padded;
};

export const extractVoicePlaybackPeaksFromChannel = (
  channel: Float32Array,
  peakCount: number = VOICE_PLAYBACK_PEAK_COUNT,
): ReadonlyArray<number> => {
  if (channel.length === 0) {
    return createFallbackVoicePlaybackPeaks(peakCount, "empty-channel");
  }

  const blockSize = Math.max(1, Math.floor(channel.length / peakCount));
  const peaks: number[] = [];
  for (let index = 0; index < peakCount; index += 1) {
    const start = index * blockSize;
    const end = Math.min(channel.length, start + blockSize);
    let max = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      max = Math.max(max, Math.abs(channel[sampleIndex] ?? 0));
    }
    peaks.push(max);
  }
  return normalizeVoicePlaybackPeaks(peaks, peakCount);
};

export const createFallbackVoicePlaybackPeaks = (
  peakCount: number = VOICE_PLAYBACK_PEAK_COUNT,
  seedInput: string = "fallback",
): ReadonlyArray<number> => {
  let seed = 0;
  for (let index = 0; index < seedInput.length; index += 1) {
    seed = (seed * 31 + seedInput.charCodeAt(index)) >>> 0;
  }

  return Array.from({ length: peakCount }, (_, index) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const wave = 0.35 + (Math.sin((index / peakCount) * Math.PI * 5) * 0.18);
    const jitter = ((seed % 1000) / 1000) * 0.25;
    return clampLevel(wave + jitter);
  });
};

export const resolveVoicePlaybackProgressPercent = (
  currentTimeSeconds: number,
  durationSeconds: number,
): number => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }
  return clampLevel(currentTimeSeconds / durationSeconds) * 100;
};

export const resolveVoicePlaybackSeekPercent = (
  clientX: number,
  bounds: DOMRect,
): number => {
  if (bounds.width <= 0) {
    return 0;
  }
  return clampLevel((clientX - bounds.left) / bounds.width) * 100;
};

const peakCache = new Map<string, ReadonlyArray<number>>();

export const readCachedVoicePlaybackPeaks = (src: string): ReadonlyArray<number> | null => (
  peakCache.get(src) ?? null
);

export const writeCachedVoicePlaybackPeaks = (
  src: string,
  peaks: ReadonlyArray<number>,
): ReadonlyArray<number> => {
  const normalized = normalizeVoicePlaybackPeaks(peaks);
  peakCache.set(src, normalized);
  return normalized;
};

export const clearVoicePlaybackPeakCache = (): void => {
  peakCache.clear();
};

export const resolveAudioContextCtor = (): typeof AudioContext | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
};

export async function decodeVoicePlaybackPeaks(
  src: string,
  peakCount: number = VOICE_PLAYBACK_PEAK_COUNT,
): Promise<ReadonlyArray<number>> {
  const cached = readCachedVoicePlaybackPeaks(src);
  if (cached) {
    return cached;
  }

  if (typeof window === "undefined") {
    return writeCachedVoicePlaybackPeaks(src, createFallbackVoicePlaybackPeaks(peakCount, src));
  }

  const AudioContextCtor = resolveAudioContextCtor();
  if (!AudioContextCtor) {
    return writeCachedVoicePlaybackPeaks(src, createFallbackVoicePlaybackPeaks(peakCount, src));
  }

  try {
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`voice_peak_fetch_failed_${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new AudioContextCtor();
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const channel = audioBuffer.getChannelData(0);
      return writeCachedVoicePlaybackPeaks(
        src,
        extractVoicePlaybackPeaksFromChannel(channel, peakCount),
      );
    }
    finally {
      await audioContext.close();
    }
  }
  catch {
    return writeCachedVoicePlaybackPeaks(src, createFallbackVoicePlaybackPeaks(peakCount, src));
  }
}
