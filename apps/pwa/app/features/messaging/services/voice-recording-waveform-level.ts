export const RECORDING_WAVEFORM_POINT_COUNT = 48;

const clampLevel = (value: number): number => Math.max(0, Math.min(1, value));

export type RecordingWaveformFrame = Readonly<{
  sample: number;
  intensity: number;
  spectralBlend: number;
}>;

export const sampleAnalyserLevel = (
  analyser: AnalyserNode,
  timeDomainBuffer: Uint8Array<ArrayBuffer>,
): number => {
  analyser.getByteTimeDomainData(timeDomainBuffer);
  let sumSquares = 0;
  for (let index = 0; index < timeDomainBuffer.length; index += 1) {
    const centered = (timeDomainBuffer[index] - 128) / 128;
    sumSquares += centered * centered;
  }
  const rms = Math.sqrt(sumSquares / timeDomainBuffer.length);
  return clampLevel((rms - 0.02) / 0.16);
};

export const sampleAnalyserFrequencyBlend = (
  analyser: AnalyserNode,
  frequencyBuffer: Uint8Array<ArrayBuffer>,
): number => {
  analyser.getByteFrequencyData(frequencyBuffer);
  const binCount = frequencyBuffer.length;
  if (binCount === 0) {
    return 0;
  }

  let lowSum = 0;
  let midSum = 0;
  let highSum = 0;
  const lowEnd = Math.max(1, Math.floor(binCount * 0.12));
  const midEnd = Math.max(lowEnd + 1, Math.floor(binCount * 0.45));

  for (let index = 0; index < binCount; index += 1) {
    const value = frequencyBuffer[index] / 255;
    if (index < lowEnd) {
      lowSum += value;
    }
    else if (index < midEnd) {
      midSum += value;
    }
    else {
      highSum += value;
    }
  }

  const lowAvg = lowSum / lowEnd;
  const midAvg = midSum / Math.max(1, midEnd - lowEnd);
  const highAvg = highSum / Math.max(1, binCount - midEnd);
  return clampLevel((lowAvg * 0.35) + (midAvg * 0.45) + (highAvg * 0.2));
};

export const sampleRecordingWaveformFrame = (
  analyser: AnalyserNode,
  timeDomainBuffer: Uint8Array<ArrayBuffer>,
  frequencyBuffer: Uint8Array<ArrayBuffer>,
): RecordingWaveformFrame => {
  const intensity = sampleAnalyserLevel(analyser, timeDomainBuffer);
  const spectralBlend = sampleAnalyserFrequencyBlend(analyser, frequencyBuffer);
  const sample = clampLevel((intensity * 0.68) + (spectralBlend * 0.32));
  return { sample, intensity, spectralBlend };
};

export const smoothRecordingWaveformSample = (
  previous: number,
  nextSample: number,
): number => {
  const normalized = clampLevel(nextSample);
  if (normalized > previous) {
    return clampLevel((previous * 0.22) + (normalized * 0.78));
  }
  return clampLevel((previous * 0.68) + (normalized * 0.32));
};

export const smoothRecordingWaveformRetract = (
  previous: number,
  nextIntensity: number,
): number => {
  const normalized = clampLevel(nextIntensity);
  if (normalized > previous) {
    return clampLevel((previous * 0.18) + (normalized * 0.82));
  }
  return clampLevel((previous * 0.78) + (normalized * 0.22));
};

export const advanceRecordingWaveformPoints = (
  points: ReadonlyArray<number>,
  nextSample: number,
): ReadonlyArray<number> => {
  const previousTail = points[points.length - 1] ?? 0;
  const smoothed = smoothRecordingWaveformSample(previousTail, nextSample);
  if (points.length <= 1) {
    return [smoothed];
  }
  return [...points.slice(1), smoothed];
};

export const createIdleRecordingWaveformPoints = (
  pointCount: number = RECORDING_WAVEFORM_POINT_COUNT,
): ReadonlyArray<number> => Array.from({ length: pointCount }, () => 0);

export const resolveRecordingWaveRetractFactor = (
  intensity: number,
  spectralBlend: number,
): number => {
  const energy = clampLevel((intensity * 0.72) + (spectralBlend * 0.28));
  return 0.08 + (energy * 0.92);
};

const buildWavePoint = (
  level: number,
  index: number,
  pointCount: number,
  width: number,
  centerY: number,
  maxAmplitude: number,
): Readonly<{ x: number; y: number }> => {
  const x = pointCount <= 1 ? 0 : (index / (pointCount - 1)) * width;
  const ripple = 0.88 + (Math.sin((index / Math.max(1, pointCount - 1)) * Math.PI * 3) * 0.12);
  const y = centerY - (level * maxAmplitude * ripple);
  return { x, y };
};

export const buildRecordingWavePath = (params: Readonly<{
  points: ReadonlyArray<number>;
  width: number;
  height: number;
  retract: number;
}>): string => {
  const { points, width, height } = params;
  if (points.length === 0 || width <= 0 || height <= 0) {
    return "";
  }

  const centerY = height / 2;
  const maxAmplitude = ((height / 2) - 1) * clampLevel(params.retract);
  const upper: Array<{ x: number; y: number }> = [];

  points.forEach((level, index) => {
    upper.push(buildWavePoint(level, index, points.length, width, centerY, maxAmplitude));
  });

  if (upper.length === 1) {
    const point = upper[0];
    return `M 0 ${centerY} L ${point.x} ${point.y} L ${width} ${centerY} Z`;
  }

  let path = `M 0 ${centerY}`;
  path += ` L ${upper[0].x.toFixed(2)} ${upper[0].y.toFixed(2)}`;

  for (let index = 1; index < upper.length; index += 1) {
    const previous = upper[index - 1];
    const current = upper[index];
    const controlX = ((previous.x + current.x) / 2).toFixed(2);
    path += ` Q ${controlX} ${previous.y.toFixed(2)} ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
  }

  path += ` L ${width} ${centerY}`;

  for (let index = upper.length - 1; index >= 0; index -= 1) {
    const point = upper[index];
    path += ` L ${point.x.toFixed(2)} ${(centerY + (centerY - point.y)).toFixed(2)}`;
  }

  path += " Z";
  return path;
};

/** @deprecated Use createIdleRecordingWaveformPoints */
export const RECORDING_WAVEFORM_BAR_COUNT = RECORDING_WAVEFORM_POINT_COUNT;

/** @deprecated Use createIdleRecordingWaveformPoints */
export const createIdleRecordingWaveformBars = createIdleRecordingWaveformPoints;

/** @deprecated Use advanceRecordingWaveformPoints */
export const advanceRecordingWaveformBars = advanceRecordingWaveformPoints;
