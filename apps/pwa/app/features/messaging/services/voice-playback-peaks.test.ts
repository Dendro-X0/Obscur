import { describe, expect, it } from "vitest";
import {
  createFallbackVoicePlaybackPeaks,
  extractVoicePlaybackPeaksFromChannel,
  normalizeVoicePlaybackPeaks,
  resolveVoicePlaybackProgressPercent,
  resolveVoicePlaybackSeekPercent,
} from "./voice-playback-peaks";

describe("voice-playback-peaks", () => {
  it("normalizes peaks to the configured count", () => {
    const normalized = normalizeVoicePlaybackPeaks([0.2, 0.8, 0.4, 1, 0.5], 4);
    expect(normalized).toEqual([0.2, 0.8, 0.4, 1]);
  });

  it("extracts block peaks from audio channel samples", () => {
    const channel = new Float32Array([
      0.1, 0.2, 0.9, 0.05,
      0.4, 0.3, 0.2, 0.1,
    ]);
    const peaks = extractVoicePlaybackPeaksFromChannel(channel, 4);
    expect(peaks.some((peak) => peak >= 0.95)).toBe(true);
    expect(peaks.some((peak) => peak <= 0.3)).toBe(true);
  });

  it("creates deterministic fallback peaks when decode is unavailable", () => {
    const first = createFallbackVoicePlaybackPeaks(12, "voice-note.webm");
    const second = createFallbackVoicePlaybackPeaks(12, "voice-note.webm");
    const other = createFallbackVoicePlaybackPeaks(12, "other.webm");
    expect(first).toEqual(second);
    expect(first).not.toEqual(other);
  });

  it("resolves playback progress and seek percentages", () => {
    expect(resolveVoicePlaybackProgressPercent(4.5, 9)).toBe(50);
    expect(resolveVoicePlaybackSeekPercent(75, {
      left: 50,
      width: 100,
    } as DOMRect)).toBe(25);
  });
});
