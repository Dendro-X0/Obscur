const ENABLE_REALTIME_VOICE_CALLS_ENV = (process.env.NEXT_PUBLIC_ENABLE_REALTIME_VOICE_CALLS ?? "").trim().toLowerCase();

const VOICE_CALLS_DISABLED_VALUES = new Set(["0", "false", "off", "disabled"]);

export const isRealtimeVoiceCallsEnabled = (): boolean => (
  !VOICE_CALLS_DISABLED_VALUES.has(ENABLE_REALTIME_VOICE_CALLS_ENV)
);
