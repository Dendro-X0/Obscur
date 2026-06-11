import { describe, expect, it } from "vitest";
import {
  countPeerIncomingInWindow,
  countTimestampsInWindow,
  detectInviteFanoutSignal,
  detectMsgRateSignal,
  INVITE_FANOUT_THRESHOLD,
  MSG_RATE_THRESHOLD,
  MSG_RATE_WINDOW_MS,
} from "./dm-kernel-trust-spam-signals";

describe("dm-kernel-trust-spam-signals", () => {
  it("counts timestamps inside rolling window", () => {
    const now = 1_700_000_000_000;
    const timestamps = [now - 30_000, now - 90_000, now - 10_000];
    expect(countTimestampsInWindow(timestamps, now, MSG_RATE_WINDOW_MS)).toBe(2);
  });

  it("detects msg.rate above threshold", () => {
    expect(detectMsgRateSignal(MSG_RATE_THRESHOLD)).toBe(false);
    expect(detectMsgRateSignal(MSG_RATE_THRESHOLD + 1)).toBe(true);
  });

  it("detects invite.fanout above threshold", () => {
    expect(detectInviteFanoutSignal(INVITE_FANOUT_THRESHOLD)).toBe(false);
    expect(detectInviteFanoutSignal(INVITE_FANOUT_THRESHOLD + 1)).toBe(true);
  });

  it("counts peer incoming messages in one-minute window", () => {
    const now = 1_700_000_000_000;
    const timestamps = Array.from({ length: 12 }, (_, index) => now - index * 4_000);
    expect(countPeerIncomingInWindow(timestamps, now)).toBe(12);
  });
});
