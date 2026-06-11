import { describe, expect, it } from "vitest";
import {
  assessDmTrustWarning,
  BUNDLE_FIN_COLD,
  BUNDLE_SPAM_COLD,
  detectFinancialMention,
  FINANCIAL_PIVOT_WINDOW_MS,
} from "./dm-kernel-trust-assessment-port";
import {
  INVITE_FANOUT_THRESHOLD,
  MSG_RATE_THRESHOLD,
} from "./dm-kernel-trust-spam-signals";

const PEER = "b".repeat(64);
const baseMs = 1_700_000_000_000;

describe("dm-kernel-trust-assessment-port", () => {
  it("detects structural financial mentions without ideology keywords alone", () => {
    expect(detectFinancialMention("Please send $500 to this wallet")).toBe(true);
    expect(detectFinancialMention("hello there")).toBe(false);
  });

  it("fires BUNDLE_FIN_COLD as elevated for cold contact + early financial pivot", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Send $200 via wire transfer today",
      messageTimestampUnixMs: baseMs + 60_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 60_000,
    });
    expect(result.bundleId).toBe(BUNDLE_FIN_COLD);
    expect(result.tier).toBe("elevated");
    expect(result.activeSignals).toContain("contact.cold");
    expect(result.activeSignals).toContain("thread.pivot_financial");
  });

  it("escalates to critical when urgency pressure is present", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Urgent: send $200 wire transfer within 24 hours",
      messageTimestampUnixMs: baseMs + 30_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 30_000,
    });
    expect(result.tier).toBe("critical");
    expect(result.activeSignals).toContain("commerce.urgency_pressure");
  });

  it("does not warn after dismiss cooldown is active", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Send $999 now",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: baseMs + 60_000,
      nowUnixMs: baseMs + 30_000,
    });
    expect(result.tier).toBe("none");
  });

  it("does not treat accepted peer financial chat as fin-cold when outside pivot window", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: true,
      messageContent: "Invoice for last month: $120",
      messageTimestampUnixMs: baseMs + FINANCIAL_PIVOT_WINDOW_MS + 1,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + FINANCIAL_PIVOT_WINDOW_MS + 1,
    });
    expect(result.bundleId).not.toBe(BUNDLE_FIN_COLD);
    expect(result.tier).toBe("none");
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Pay $50 asap",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs,
    } as const;
    expect(assessDmTrustWarning(input)).toEqual(assessDmTrustWarning(input));
  });

  it("fires BUNDLE_SPAM_COLD for cold contact + high msg.rate", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "hello again",
      messageTimestampUnixMs: baseMs + 30_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD + 1,
      nowUnixMs: baseMs + 30_000,
    });
    expect(result.bundleId).toBe(BUNDLE_SPAM_COLD);
    expect(result.tier).toBe("elevated");
    expect(result.activeSignals).toContain("msg.rate");
    expect(result.activeSignals).toContain("contact.cold");
  });

  it("elevates on msg.rate alone for accepted peer burst", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: true,
      messageContent: "message flood",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD + 3,
      nowUnixMs: baseMs,
    });
    expect(result.tier).toBe("elevated");
    expect(result.activeSignals).toEqual(["msg.rate"]);
    expect(result.copyKey).toBe("messaging.trust.msgRate");
  });

  it("elevates on invite.fanout from repeated connection requests", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "please accept",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      peerConnectionRequestCountLastDay: INVITE_FANOUT_THRESHOLD + 1,
      nowUnixMs: baseMs,
    });
    expect(result.tier).toBe("elevated");
    expect(result.activeSignals).toContain("invite.fanout");
    expect(result.copyKey).toBe("messaging.trust.inviteFanout");
  });
});
