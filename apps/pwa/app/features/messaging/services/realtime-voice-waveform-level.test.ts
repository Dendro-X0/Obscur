import { describe, expect, it } from "vitest";
import {
  advanceVoiceWaveAudioLevelChannel,
  getVoiceWaveOverlayLevel,
  type VoiceWaveAudioLevelState,
} from "./realtime-voice-waveform-level";

describe("realtime-voice-waveform-level", () => {
  it("raises and combines local or remote activity into one overlay level", () => {
    const start: VoiceWaveAudioLevelState = { local: 0, remote: 0 };
    const next = advanceVoiceWaveAudioLevelChannel({
      current: start,
      channel: "local",
      nextSample: 0.8,
    });
    expect(next.local).toBeGreaterThan(0.5);
    expect(getVoiceWaveOverlayLevel(next)).toBe(next.local);
  });

  it("decays repeated silence fully back to zero after prior activity", () => {
    let current: VoiceWaveAudioLevelState = { local: 0, remote: 0 };
    current = advanceVoiceWaveAudioLevelChannel({
      current,
      channel: "remote",
      nextSample: 0.9,
    });

    for (let index = 0; index < 40; index += 1) {
      current = advanceVoiceWaveAudioLevelChannel({
        current,
        channel: "remote",
        nextSample: 0,
      });
    }

    expect(current.remote).toBe(0);
    expect(getVoiceWaveOverlayLevel(current)).toBe(0);
  });
});
