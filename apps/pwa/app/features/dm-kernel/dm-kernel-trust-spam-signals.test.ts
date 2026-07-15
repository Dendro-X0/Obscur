import { describe, expect, it } from "vitest";
import {
  ACCEPTED_PEER_MSG_RATE_FLOOD_MULTIPLIER,
  countPeerIncomingInWindow,
  countTimestampsInWindow,
  detectInviteFanoutSignal,
  detectMsgRateSignal,
  INVITE_FANOUT_THRESHOLD,
  MSG_RATE_THRESHOLD,
  MSG_RATE_WINDOW_MS,
  resolveMsgRateThreshold,
  shouldTriggerMsgRateSignal,
} from "./dm-kernel-trust-spam-signals";

describe("dm-kernel-trust-spam-signals", () => {
  it("counts timestamps inside rolling window", () => {
    const now = 1_700_000_000_000;
    const timestamps = [now - 30_000, now - 130_000, now - 10_000];
    expect(countTimestampsInWindow(timestamps, now, MSG_RATE_WINDOW_MS)).toBe(2);
  });

  it("detects msg.rate above base cold threshold", () => {
    expect(detectMsgRateSignal(MSG_RATE_THRESHOLD)).toBe(false);
    expect(detectMsgRateSignal(MSG_RATE_THRESHOLD + 1)).toBe(true);
  });

  it("requires flood tier for accepted peers before msg.rate fires", () => {
    const baseThreshold = MSG_RATE_THRESHOLD;
    const floodThreshold = resolveMsgRateThreshold({
      peerIncomingCountLastMinute: 0,
      msgRateThreshold: baseThreshold,
      isContactCold: false,
      isPeerAccepted: true,
    });
    expect(floodThreshold).toBe(Math.ceil(baseThreshold * ACCEPTED_PEER_MSG_RATE_FLOOD_MULTIPLIER));
    expect(shouldTriggerMsgRateSignal({
      peerIncomingCountLastMinute: baseThreshold + 5,
      msgRateThreshold: baseThreshold,
      isContactCold: false,
      isPeerAccepted: true,
    })).toBe(false);
    expect(shouldTriggerMsgRateSignal({
      peerIncomingCountLastMinute: floodThreshold + 1,
      msgRateThreshold: baseThreshold,
      isContactCold: false,
      isPeerAccepted: true,
    })).toBe(true);
  });

  it("uses base threshold for cold contacts", () => {
    expect(shouldTriggerMsgRateSignal({
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD + 1,
      msgRateThreshold: MSG_RATE_THRESHOLD,
      isContactCold: true,
      isPeerAccepted: false,
    })).toBe(true);
  });

  it("detects invite.fanout above threshold", () => {
    expect(detectInviteFanoutSignal(INVITE_FANOUT_THRESHOLD)).toBe(false);
    expect(detectInviteFanoutSignal(INVITE_FANOUT_THRESHOLD + 1)).toBe(true);
  });

  it("counts peer incoming messages in rate window", () => {
    const now = 1_700_000_000_000;
    const timestamps = Array.from({ length: 12 }, (_, index) => now - index * 4_000);
    expect(countPeerIncomingInWindow(timestamps, now)).toBe(12);
  });
});
