const ENABLE_REALTIME_VOICE_CALLS_ENV = (process.env.NEXT_PUBLIC_ENABLE_REALTIME_VOICE_CALLS ?? "").trim().toLowerCase();

export const isRealtimeVoiceCallsEnabled = (): boolean => (
  ENABLE_REALTIME_VOICE_CALLS_ENV === "1"
  || ENABLE_REALTIME_VOICE_CALLS_ENV === "true"
  || ENABLE_REALTIME_VOICE_CALLS_ENV === "on"
);

