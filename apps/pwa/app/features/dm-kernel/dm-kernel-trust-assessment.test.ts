import { describe, expect, it } from "vitest";
import {
  assessDmTrustWarning,
  BUNDLE_FIN_COLD,
  BUNDLE_PHISH_COLD,
  BUNDLE_SE_COLD,
  BUNDLE_SPAM_COLD,
  detectFinancialMention,
  FINANCIAL_PIVOT_WINDOW_MS,
  resolveTrustActionFriction,
} from "./dm-kernel-trust-assessment-port";
import {
  INVITE_FANOUT_THRESHOLD,
  MSG_RATE_THRESHOLD,
  resolveMsgRateThreshold,
} from "./dm-kernel-trust-spam-signals";

const PEER = "b".repeat(64);
const baseMs = 1_700_000_000_000;

describe("dm-kernel-trust-assessment-port", () => {
  it("detects structural financial mentions without ideology keywords alone", () => {
    expect(detectFinancialMention("Please send $500 to this wallet")).toBe(true);
    expect(detectFinancialMention("hello there")).toBe(false);
  });

  it("fires BUNDLE_PHISH_COLD for cold contact + suspicious credential URL", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Verify at https://wallet-security.example/login?id=1",
      messageTimestampUnixMs: baseMs + 60_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 60_000,
    });
    expect(result.bundleId).toBe(BUNDLE_PHISH_COLD);
    expect(result.tier).toBe("elevated");
    expect(result.activeSignals).toContain("link.suspicious_url");
    expect(result.copyKey).toBe("messaging.trust.phishCold");
  });

  it("prefers BUNDLE_FIN_COLD when financial pivot and suspicious URL both fire", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Send $200 — https://pay.example/login",
      messageTimestampUnixMs: baseMs + 30_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 30_000,
    });
    expect(result.bundleId).toBe(BUNDLE_FIN_COLD);
    expect(result.activeSignals).toContain("link.suspicious_url");
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

  it("does not warn on accepted peer normal conversation burst", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: true,
      messageContent: "quick back-and-forth",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD + 3,
      nowUnixMs: baseMs,
    });
    expect(result.activeSignals).not.toContain("msg.rate");
    expect(result.tier).toBe("none");
  });

  it("infos on msg.rate flood for accepted peer burst", () => {
    const floodCount = resolveMsgRateThreshold({
      peerIncomingCountLastMinute: 0,
      msgRateThreshold: MSG_RATE_THRESHOLD,
      isContactCold: false,
      isPeerAccepted: true,
    }) + 1;
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: true,
      messageContent: "message flood",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      peerIncomingCountLastMinute: floodCount,
      nowUnixMs: baseMs,
    });
    expect(result.tier).toBe("info");
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

  it("fires BUNDLE_SE_COLD for cold contact + credential harvest", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Obscur Support — send your 12-word seed phrase to unlock your account",
      messageTimestampUnixMs: baseMs + 60_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 60_000,
    });
    expect(result.bundleId).toBe(BUNDLE_SE_COLD);
    expect(result.tier).toBe("critical");
    expect(result.copyKey).toBe("messaging.trust.seCredentialCold");
  });

  it("elevates credential harvest on accepted peer without fin-cold bundle", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: true,
      messageContent: "Please paste your private key here for verification",
      messageTimestampUnixMs: baseMs + 120_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 120_000,
    });
    expect(result.bundleId).toBeNull();
    expect(result.tier).toBe("critical");
    expect(result.activeSignals).toContain("thread.credential_harvest");
  });

  it("fires BUNDLE_FIN_COLD for cold contact financial ask outside pivot window", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Hi — can you send $200 via wire transfer today?",
      messageTimestampUnixMs: baseMs + FINANCIAL_PIVOT_WINDOW_MS + 3_600_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + FINANCIAL_PIVOT_WINDOW_MS + 3_600_000,
    });
    expect(result.bundleId).toBe(BUNDLE_FIN_COLD);
    expect(result.tier).toBe("elevated");
    expect(result.activeSignals).toContain("thread.financial_pressure");
    expect(result.activeSignals).not.toContain("thread.pivot_financial");
  });

  it("fires BUNDLE_SE_COLD for cold contact off-platform redirect", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Move to WhatsApp so we can talk about the job offer",
      messageTimestampUnixMs: baseMs + 45_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 45_000,
    });
    expect(result.bundleId).toBe(BUNDLE_SE_COLD);
    expect(result.tier).toBe("elevated");
    expect(result.activeSignals).toContain("thread.off_platform_redirect");
  });

  it("fires critical SE for cold contact remote access install", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Install AnyDesk so we can walk through the onboarding",
      messageTimestampUnixMs: baseMs + 45_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 45_000,
    });
    expect(result.bundleId).toBe(BUNDLE_SE_COLD);
    expect(result.tier).toBe("critical");
    expect(result.activeSignals).toContain("thread.remote_access_tool");
  });

  it("fires critical SE for accepted peer hiring trap repo run", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: true,
      messageContent: "Clone this repository and run npm install for the interview task",
      messageTimestampUnixMs: baseMs + 120_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 120_000,
    });
    expect(result.bundleId).toBeNull();
    expect(result.tier).toBe("critical");
    expect(result.activeSignals).toContain("thread.hiring_trap");
  });

  it("fires SE bundle for cold contact overpayment refund scam", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "We overpaid by mistake — please refund the difference today",
      messageTimestampUnixMs: baseMs + 90_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 90_000,
    });
    expect(result.bundleId).toBe(BUNDLE_SE_COLD);
    expect(result.tier).toBe("elevated");
    expect(result.activeSignals).toContain("thread.overpayment_refund");
  });

  it("fires BUNDLE_PHISH_COLD for cold contact + lookalike brand URL", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Restore access: https://obscur-wallet-verify.example/start",
      messageTimestampUnixMs: baseMs + 45_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 45_000,
    });
    expect(result.bundleId).toBe(BUNDLE_PHISH_COLD);
    expect(result.tier).toBe("elevated");
    expect(result.activeSignals).toContain("link.lookalike_brand");
  });

  it("fires BUNDLE_PHISH_COLD for cold contact + risky attachment filename", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Please review the attached brief",
      messageAttachmentFileNames: ["Project-Spec.pdf.exe"],
      messageTimestampUnixMs: baseMs + 45_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 45_000,
    });
    expect(result.bundleId).toBe(BUNDLE_PHISH_COLD);
    expect(result.tier).toBe("elevated");
    expect(result.activeSignals).toContain("attachment.risky_filename");
    expect(result.copyKey).toBe("messaging.trust.phishAttachmentCold");
  });

  it("assesses unaccepted group member with structural phish signals", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Verify wallet: https://obscur-wallet-verify.example/start",
      messageTimestampUnixMs: baseMs + 30_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs + 30_000,
    });
    expect(result.bundleId).toBe(BUNDLE_PHISH_COLD);
    expect(result.copyKey).toBe("messaging.trust.phishLookalikeCold");
  });

  it("flags young key age on cold contact", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "hey",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      peerFirstSeenAtUnixMs: baseMs - 3 * 60 * 60 * 1000,
      nowUnixMs: baseMs,
    });
    expect(result.activeSignals).toContain("key.age");
    expect(result.tier).toBe("info");
  });

  it("flags outside-web WoT distance separately from accepted-peer vigilant cold", () => {
    const outsideWeb = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "hello",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      peerWotDistance: null,
      nowUnixMs: baseMs,
    });
    expect(outsideWeb.activeSignals).toContain("graph.wot_distance");

    const acceptedVigilant = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: true,
      messageContent: "hello",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      peerWotDistance: 1,
      contactTrustSensitivity: "vigilant",
      nowUnixMs: baseMs,
    });
    expect(acceptedVigilant.activeSignals).toContain("contact.cold");
    expect(acceptedVigilant.activeSignals).not.toContain("graph.wot_distance");
  });

  it("elevates cold contacts when attachment repeat-hash fanout threshold is met", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "see attachment",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      attachmentRepeatHashDistinctPeerCount: 3,
      nowUnixMs: baseMs,
    });
    expect(result.activeSignals).toContain("attachment.repeat_hash");
    expect(result.tier).toBe("elevated");
    expect(result.copyKey).toBe("messaging.trust.repeatHashCold");
  });

  it("maps trust tiers to ASE friction levels", () => {
    const critical = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Pay $50 asap",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs,
    });
    expect(resolveTrustActionFriction(critical)).toBe("confirm");

    const none = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: true,
      messageContent: "see you tomorrow",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD + 3,
      nowUnixMs: baseMs,
    });
    expect(resolveTrustActionFriction(none)).toBe("none");
  });
});
