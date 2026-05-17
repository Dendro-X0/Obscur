export type VoiceWaveAudioLevelState = Readonly<{
  local: number;
  remote: number;
}>;

const clampAudioLevel = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
};

export const advanceVoiceWaveAudioLevelChannel = (params: Readonly<{
  current: VoiceWaveAudioLevelState;
  channel: "local" | "remote";
  nextSample: number;
}>): VoiceWaveAudioLevelState => {
  const normalizedLevel = clampAudioLevel(params.nextSample);
  const previousLevel = params.channel === "local"
    ? params.current.local
    : params.current.remote;
  let nextLevel = normalizedLevel > previousLevel
    ? (previousLevel * 0.3) + (normalizedLevel * 0.7)
    : (previousLevel * 0.82) + (normalizedLevel * 0.18);

  if (normalizedLevel === 0 && nextLevel < 0.015) {
    nextLevel = 0;
  }

  if (Math.abs(nextLevel - previousLevel) < 0.003) {
    return params.current;
  }

  return params.channel === "local"
    ? { ...params.current, local: nextLevel }
    : { ...params.current, remote: nextLevel };
};

export const getVoiceWaveOverlayLevel = (levels: VoiceWaveAudioLevelState): number => (
  Math.max(clampAudioLevel(levels.local), clampAudioLevel(levels.remote))
);
