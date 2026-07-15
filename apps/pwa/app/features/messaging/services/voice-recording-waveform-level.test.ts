import { describe, expect, it } from "vitest";
import {
  advanceRecordingWaveformPoints,
  buildRecordingWavePath,
  createIdleRecordingWaveformPoints,
  resolveRecordingWaveRetractFactor,
  sampleAnalyserFrequencyBlend,
  sampleAnalyserLevel,
  sampleRecordingWaveformFrame,
  smoothRecordingWaveformRetract,
  smoothRecordingWaveformSample,
} from "./voice-recording-waveform-level";

describe("voice-recording-waveform-level", () => {
  it("smooths rising samples quickly and falling samples gradually", () => {
    const rising = smoothRecordingWaveformSample(0.1, 0.9);
    const falling = smoothRecordingWaveformSample(0.9, 0.1);
    expect(rising).toBeGreaterThan(0.5);
    expect(falling).toBeGreaterThan(0.1);
    expect(falling).toBeLessThan(0.9);
  });

  it("retracts the wave envelope during silence and expands it with energy", () => {
    const expanded = smoothRecordingWaveformRetract(0.1, 0.95);
    const retracted = smoothRecordingWaveformRetract(0.9, 0.05);
    expect(expanded).toBeGreaterThan(0.7);
    expect(retracted).toBeLessThan(expanded);
    expect(resolveRecordingWaveRetractFactor(0, 0)).toBeCloseTo(0.08, 2);
    expect(resolveRecordingWaveRetractFactor(1, 1)).toBe(1);
  });

  it("scrolls waveform points forward with each new sample", () => {
    const idle = createIdleRecordingWaveformPoints(4);
    const first = advanceRecordingWaveformPoints(idle, 0.8);
    const second = advanceRecordingWaveformPoints(first, 0.2);

    expect(first).toEqual([0, 0, 0, expect.any(Number)]);
    expect(first[3]).toBeGreaterThan(0.5);
    expect(second[0]).toBe(0);
    expect(second[1]).toBe(0);
    expect(second[2]).toBe(first[3]);
  });

  it("derives analyser level from time-domain samples", () => {
    const analyser = {
      fftSize: 8,
      getByteTimeDomainData: (buffer: Uint8Array<ArrayBuffer>) => {
        for (let index = 0; index < buffer.length; index += 1) {
          buffer[index] = index % 2 === 0 ? 200 : 56;
        }
      },
    } as AnalyserNode;
    const buffer = new Uint8Array(analyser.fftSize);
    expect(sampleAnalyserLevel(analyser, buffer)).toBeGreaterThan(0.2);
  });

  it("blends low, mid, and high frequency bands into a spectral sample", () => {
    const analyser = {
      frequencyBinCount: 32,
      getByteFrequencyData: (buffer: Uint8Array<ArrayBuffer>) => {
        for (let index = 0; index < buffer.length; index += 1) {
          buffer[index] = index < 8 ? 220 : index < 16 ? 120 : 40;
        }
      },
    } as AnalyserNode;
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    expect(sampleAnalyserFrequencyBlend(analyser, buffer)).toBeGreaterThan(0.25);
  });

  it("combines intensity and spectral energy into one scrolling frame", () => {
    const analyser = {
      fftSize: 8,
      frequencyBinCount: 16,
      getByteTimeDomainData: (buffer: Uint8Array<ArrayBuffer>) => {
        for (let index = 0; index < buffer.length; index += 1) {
          buffer[index] = index % 2 === 0 ? 190 : 70;
        }
      },
      getByteFrequencyData: (buffer: Uint8Array<ArrayBuffer>) => {
        for (let index = 0; index < buffer.length; index += 1) {
          buffer[index] = 180;
        }
      },
    } as AnalyserNode;

    const frame = sampleRecordingWaveformFrame(
      analyser,
      new Uint8Array(analyser.fftSize),
      new Uint8Array(analyser.frequencyBinCount),
    );

    expect(frame.intensity).toBeGreaterThan(0.1);
    expect(frame.spectralBlend).toBeGreaterThan(0.4);
    expect(frame.sample).toBeGreaterThan(0.2);
  });

  it("builds a closed wave path that retracts toward the center line", () => {
    const points = [0.1, 0.4, 0.9, 0.5, 0.2];
    const expanded = buildRecordingWavePath({
      points,
      width: 100,
      height: 24,
      retract: 1,
    });
    const retracted = buildRecordingWavePath({
      points,
      width: 100,
      height: 24,
      retract: 0.1,
    });
    const maxDeviation = (path: string, centerY: number): number => {
      const matches = [...path.matchAll(/L (\d+\.?\d*) (\d+\.?\d*)/g)];
      return Math.max(...matches.map((match) => Math.abs(Number(match[2]) - centerY)), 0);
    };

    expect(expanded.startsWith("M 0 12")).toBe(true);
    expect(expanded.endsWith("Z")).toBe(true);
    expect(retracted.startsWith("M 0 12")).toBe(true);
    expect(maxDeviation(expanded, 12)).toBeGreaterThan(maxDeviation(retracted, 12));
  });
});
