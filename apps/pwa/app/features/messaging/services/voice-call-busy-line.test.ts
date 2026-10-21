import { describe, expect, it } from "vitest";
import {
  canStartVoiceCallInviteWhileLineIdle,
  isVoiceCallLineBusy,
  shouldDeferVoiceInviteForBusyLine,
} from "./voice-call-busy-line";

describe("isVoiceCallLineBusy", () => {
  it("is busy for ring/connect/connected", () => {
    expect(isVoiceCallLineBusy("ringing_outgoing")).toBe(true);
    expect(isVoiceCallLineBusy("ringing_incoming")).toBe(true);
    expect(isVoiceCallLineBusy("connecting")).toBe(true);
    expect(isVoiceCallLineBusy("connected")).toBe(true);
  });

  it("is idle for ended/interrupted/null", () => {
    expect(isVoiceCallLineBusy("ended")).toBe(false);
    expect(isVoiceCallLineBusy("interrupted")).toBe(false);
    expect(isVoiceCallLineBusy(null)).toBe(false);
  });
});

describe("shouldDeferVoiceInviteForBusyLine", () => {
  it("defers third-party while connected even when RTC omitted", () => {
    expect(shouldDeferVoiceInviteForBusyLine({ phase: "connected" })).toBe(true);
  });

  it("defers when RTC is live even if phase briefly null", () => {
    expect(shouldDeferVoiceInviteForBusyLine({
      phase: null,
      rtcConnectionState: "connected",
    })).toBe(true);
  });

  it("does not defer when idle", () => {
    expect(shouldDeferVoiceInviteForBusyLine({
      phase: "ended",
      rtcConnectionState: "closed",
    })).toBe(false);
  });
});

describe("canStartVoiceCallInviteWhileLineIdle", () => {
  it("blocks outbound dial while connected", () => {
    expect(canStartVoiceCallInviteWhileLineIdle({ phase: "connected" })).toBe(false);
  });

  it("allows outbound when idle", () => {
    expect(canStartVoiceCallInviteWhileLineIdle({ phase: null })).toBe(true);
    expect(canStartVoiceCallInviteWhileLineIdle({ phase: "ended" })).toBe(true);
  });
});
