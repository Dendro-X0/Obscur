import { describe, expect, it } from "vitest";
import { assessRelayAddTrust } from "./relay-add-trust-assessment";
import type { RelayMetrics } from "@/app/features/security/services/relay-trust-scorer";

describe("relay-add-trust-assessment SEC-R2", () => {
  it("rejects invalid relay URLs before add", () => {
    const assessment = assessRelayAddTrust({ rawUrl: "http://relay.example.com" });
    expect(assessment.allowed).toBe(false);
    expect(assessment.reasonCode).toBe("invalid_url");
    expect(assessment.normalizedUrl).toBeNull();
  });

  it("allows public default relays with workspace honesty notice", () => {
    const assessment = assessRelayAddTrust({ rawUrl: "wss://nos.lol" });
    expect(assessment.allowed).toBe(true);
    expect(assessment.normalizedUrl).toBe("wss://nos.lol");
    expect(assessment.capabilityTier).toBe("public_default");
    expect(assessment.reasonCode).toBe("public_default_notice");
    expect(assessment.showWorkspaceNotice).toBe(true);
    expect(assessment.userMessage).toContain("managed workspace");
  });

  it("classifies localhost dev relays as intranet workspace candidates", () => {
    const assessment = assessRelayAddTrust({
      rawUrl: "ws://localhost:7000",
      allowLocalhostWs: true,
    });
    expect(assessment.allowed).toBe(true);
    expect(assessment.capabilityTier).toBe("managed_intranet");
    expect(assessment.reasonCode).toBe("allowed");
    expect(assessment.showWorkspaceNotice).toBe(false);
  });

  it("classifies custom wss relays as trusted private candidates", () => {
    const assessment = assessRelayAddTrust({ rawUrl: "wss://relay.team.example" });
    expect(assessment.allowed).toBe(true);
    expect(assessment.capabilityTier).toBe("trusted_private");
    expect(assessment.showWorkspaceNotice).toBe(false);
  });

  it("includes behavioral score when prior metrics exist", () => {
    const existingBehavioralMetrics: RelayMetrics = {
      url: "wss://nos.lol",
      totalAttempts: 50,
      successfulDeliveries: 10,
      failedDeliveries: 40,
      avgLatencyMs: 1500,
      lastSuccessAt: null,
      lastFailureAt: Date.now(),
      consecutiveFailures: 5,
      firstSeenAt: Date.now() - 86_400_000,
      userReports: "none",
    };
    const assessment = assessRelayAddTrust({
      rawUrl: "wss://nos.lol",
      existingBehavioralMetrics,
    });
    expect(assessment.behavioralScore).not.toBeNull();
    expect(assessment.behavioralTrustLevel).toBe("untrusted");
    expect(assessment.allowed).toBe(true);
  });

  it("can block re-add when behavioral trust is untrusted", () => {
    const existingBehavioralMetrics: RelayMetrics = {
      url: "wss://nos.lol",
      totalAttempts: 10,
      successfulDeliveries: 0,
      failedDeliveries: 10,
      avgLatencyMs: 0,
      lastSuccessAt: null,
      lastFailureAt: Date.now(),
      consecutiveFailures: 0,
      firstSeenAt: Date.now(),
      userReports: "blocked",
    };
    const assessment = assessRelayAddTrust({
      rawUrl: "wss://nos.lol",
      existingBehavioralMetrics,
      blockBehaviorallyUntrusted: true,
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.reasonCode).toBe("behavioral_untrusted");
  });
});
