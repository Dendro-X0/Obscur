import { describe, expect, it } from "vitest";
import {
  canApplyRelayInferredMemberRemoval,
  resolveRelayEvidenceConfidence,
} from "./community-relay-evidence-policy";

describe("community-relay-evidence-policy", () => {
  it("blocks relay-inferred removal until steady_state", () => {
    expect(canApplyRelayInferredMemberRemoval("seed_only")).toBe(false);
    expect(canApplyRelayInferredMemberRemoval("warming_up")).toBe(false);
    expect(canApplyRelayInferredMemberRemoval("partial_eose")).toBe(false);
    expect(canApplyRelayInferredMemberRemoval("steady_state")).toBe(true);
  });

  it("resolves steady_state without EOSE when enough events and quiet period elapsed", () => {
    const nowMs = 20_000;
    const confidence = resolveRelayEvidenceConfidence({
      subscriptionEstablishedAt: 0,
      lastEventReceivedAt: nowMs - 6_000,
      eoseReceivedAt: null,
      eventCount: 4,
      nowMs,
    });
    expect(confidence).toBe("steady_state");
  });

  it("resolves steady_state after quiet period with enough events", () => {
    const nowMs = 20_000;
    const confidence = resolveRelayEvidenceConfidence({
      subscriptionEstablishedAt: 0,
      lastEventReceivedAt: nowMs - 6_000,
      eoseReceivedAt: 5_000,
      eventCount: 4,
      nowMs,
    });
    expect(confidence).toBe("steady_state");
    expect(canApplyRelayInferredMemberRemoval(confidence)).toBe(true);
  });
});
