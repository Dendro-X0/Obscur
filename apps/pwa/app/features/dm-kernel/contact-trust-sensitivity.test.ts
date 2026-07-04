import { describe, expect, it } from "vitest";
import {
  assessDmTrustWarning,
  BUNDLE_FIN_COLD,
  FINANCIAL_PIVOT_WINDOW_MS,
} from "./dm-kernel-trust-assessment-port";
import {
  applyContactTrustSensitivityToAssessment,
  resolveContactTrustSensitivityPolicy,
  resolveEffectiveColdContact,
} from "./contact-trust-sensitivity";

const PEER = "aa".repeat(32);
const NOW = 1_700_000_000_000;

const baseAcceptedInput = {
  peerPublicKeyHex: PEER,
  isPeerAccepted: true,
  messageContent: "Please send $500 via wire transfer",
  messageTimestampUnixMs: NOW,
  threadFirstPeerMessageAtUnixMs: NOW - 60_000,
  dismissedUntilUnixMs: null,
  nowUnixMs: NOW,
};

describe("contact-trust-sensitivity", () => {
  it("relaxed suppresses cold-contact fin bundle for accepted peers", () => {
    const result = assessDmTrustWarning({
      ...baseAcceptedInput,
      contactTrustSensitivity: "relaxed",
    });
    expect(result.bundleId).toBeNull();
    expect(result.tier).toBe("info");
    expect(result.activeSignals).toContain("thread.pivot_financial");
    expect(result.activeSignals).not.toContain("contact.cold");
  });

  it("vigilant elevates fin-cold on accepted peers", () => {
    const result = assessDmTrustWarning({
      ...baseAcceptedInput,
      contactTrustSensitivity: "vigilant",
    });
    expect(result.bundleId).toBe(BUNDLE_FIN_COLD);
    expect(result.tier).toBe("elevated");
    expect(result.activeSignals).toContain("contact.cold");
  });

  it("standard keeps accepted peer financial mention at info without cold bundle", () => {
    const result = assessDmTrustWarning({
      ...baseAcceptedInput,
      contactTrustSensitivity: "standard",
    });
    expect(result.bundleId).toBeNull();
    expect(result.tier).toBe("info");
    expect(result.activeSignals).not.toContain("contact.cold");
  });

  it("resolveEffectiveColdContact respects policy overrides", () => {
    const policy = resolveContactTrustSensitivityPolicy("vigilant");
    expect(resolveEffectiveColdContact({
      isPeerAccepted: true,
      threadFirstPeerMessageAtUnixMs: NOW,
      policy,
    })).toBe(true);

    const relaxedPolicy = resolveContactTrustSensitivityPolicy("relaxed");
    expect(resolveEffectiveColdContact({
      isPeerAccepted: true,
      threadFirstPeerMessageAtUnixMs: NOW,
      policy: relaxedPolicy,
    })).toBe(false);
  });

  it("cautious shortens financial pivot window", () => {
    const anchor = NOW - Math.floor(FINANCIAL_PIVOT_WINDOW_MS / 2) - 1;
    const result = assessDmTrustWarning({
      ...baseAcceptedInput,
      threadFirstPeerMessageAtUnixMs: anchor,
      contactTrustSensitivity: "cautious",
    });
    expect(result.activeSignals).not.toContain("thread.pivot_financial");
  });

  it("applyContactTrustSensitivityToAssessment elevates info tier when vigilant", () => {
    const policy = resolveContactTrustSensitivityPolicy("vigilant");
    const adjusted = applyContactTrustSensitivityToAssessment({
      tier: "info",
      bundleId: null,
      activeSignals: ["thread.pivot_financial"],
      copyKey: "messaging.trust.info",
    }, policy);
    expect(adjusted.tier).toBe("elevated");
  });
});
