import { describe, expect, it } from "vitest";
import {
  assessDmTrustActionGate,
  requiresTrustConfirmBeforeSend,
  shouldJunkIncomingRequestAssessment,
} from "./dm-kernel-trust-action-gate";
import { BUNDLE_FIN_COLD, BUNDLE_SE_COLD } from "./dm-kernel-trust-assessment-port";

const PEER = "c".repeat(64);
const baseMs = 1_700_200_000_000;

describe("dm-kernel-trust-action-gate", () => {
  it("requires confirm friction for cold financial outbound", () => {
    expect(requiresTrustConfirmBeforeSend({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Pay $500 wire transfer ASAP",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs,
    })).toBe(true);
    const gate = assessDmTrustActionGate({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Pay $500 wire transfer ASAP",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs,
    });
    expect(gate.friction).toBe("confirm");
  });

  it("requires warn friction for elevated fin-cold without urgency", () => {
    const gate = assessDmTrustActionGate({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Can you send $200 via wire transfer today?",
      messageTimestampUnixMs: baseMs + 30_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs + 30_000,
    });
    expect(gate.assessment.bundleId).toBe(BUNDLE_FIN_COLD);
    expect(gate.friction).toBe("warn");
    expect(requiresTrustConfirmBeforeSend({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Can you send $200 via wire transfer today?",
      messageTimestampUnixMs: baseMs + 30_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs + 30_000,
    })).toBe(true);
  });

  it("does not step up accepted peer outbound", () => {
    expect(requiresTrustConfirmBeforeSend({
      peerPublicKeyHex: PEER,
      isPeerAccepted: true,
      messageContent: "Pay $500 wire transfer ASAP",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs,
    })).toBe(false);
  });

  it("maps assessment bundles through the action gate", () => {
    const gate = assessDmTrustActionGate({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Send your 12-word seed phrase to verify",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs,
    });
    expect(gate.assessment.bundleId).toBe(BUNDLE_SE_COLD);
    expect(gate.friction).toBe("confirm");
  });

  it("maps fin-cold to confirm friction", () => {
    const gate = assessDmTrustActionGate({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Urgent: send $200 today",
      messageTimestampUnixMs: baseMs + 30_000,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs + 30_000,
    });
    expect(gate.assessment.bundleId).toBe(BUNDLE_FIN_COLD);
    expect(gate.friction).toBe("confirm");
  });

  it("routes junk when assessment has non-cold risky signals", () => {
    const gate = assessDmTrustActionGate({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Please send your seed phrase",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs,
    });
    expect(gate.assessment.bundleId).toBe(BUNDLE_SE_COLD);
    expect(shouldJunkIncomingRequestAssessment(gate.assessment)).toBe(true);
  });

  it("includes graph.wot_distance for outside-web request previews", () => {
    const gate = assessDmTrustActionGate({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Hi there",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs,
    });
    expect(gate.assessment.activeSignals).toContain("graph.wot_distance");
    expect(gate.assessment.activeSignals).toContain("contact.cold");
  });

  it("does not junk benign stranger previews on weak metadata alone", () => {
    const gate = assessDmTrustActionGate({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "Hi — would love to connect.",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs,
    });
    expect(gate.assessment.activeSignals).toContain("graph.wot_distance");
    expect(shouldJunkIncomingRequestAssessment(gate.assessment)).toBe(false);
  });
});
