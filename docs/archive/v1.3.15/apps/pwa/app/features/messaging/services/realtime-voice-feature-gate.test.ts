import { afterEach, describe, expect, it, vi } from "vitest";

const loadGate = async () => {
  vi.resetModules();
  return import("./realtime-voice-feature-gate");
};

describe("realtime voice feature gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enables realtime voice calls by default when env is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_REALTIME_VOICE_CALLS", "");
    const { isRealtimeVoiceCallsEnabled } = await loadGate();
    expect(isRealtimeVoiceCallsEnabled()).toBe(true);
  });

  it("disables realtime voice calls when env is explicitly off", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_REALTIME_VOICE_CALLS", "off");
    const { isRealtimeVoiceCallsEnabled } = await loadGate();
    expect(isRealtimeVoiceCallsEnabled()).toBe(false);
  });
});
