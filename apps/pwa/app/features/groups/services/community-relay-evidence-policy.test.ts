import { describe, expect, it } from "vitest";
import {
  resolveRelayEvidenceConfidence,
  shouldRelaxThinnerSnapshotGuard,
  formatRelayEvidenceConfidence,
  type RelayEvidencePolicyParams,
} from "./community-relay-evidence-policy";

describe("community-relay-evidence-policy", () => {
  const nowMs = 1000000;

  describe("resolveRelayEvidenceConfidence", () => {
    it("returns seed_only when no subscription established", () => {
      const params: RelayEvidencePolicyParams = {
        subscriptionEstablishedAt: null,
        lastEventReceivedAt: null,
        eoseReceivedAt: null,
        eventCount: 0,
        nowMs,
      };
      expect(resolveRelayEvidenceConfidence(params)).toBe("seed_only");
    });

    it("returns warming_up when subscription < 10s ago", () => {
      const params: RelayEvidencePolicyParams = {
        subscriptionEstablishedAt: nowMs - 5000, // 5s ago
        lastEventReceivedAt: null,
        eoseReceivedAt: null,
        eventCount: 0,
        nowMs,
      };
      expect(resolveRelayEvidenceConfidence(params)).toBe("warming_up");
    });

    it("returns partial_eose when EOSE received but few events", () => {
      const params: RelayEvidencePolicyParams = {
        subscriptionEstablishedAt: nowMs - 15000,
        lastEventReceivedAt: nowMs - 2000,
        eoseReceivedAt: nowMs - 3000,
        eventCount: 2, // Below STEADY_STATE_MIN_EVENTS
        nowMs,
      };
      expect(resolveRelayEvidenceConfidence(params)).toBe("partial_eose");
    });

    it("returns steady_state when EOSE + many events + quiet period", () => {
      const params: RelayEvidencePolicyParams = {
        subscriptionEstablishedAt: nowMs - 30000,
        lastEventReceivedAt: nowMs - 6000, // 6s ago (> 5s quiet)
        eoseReceivedAt: nowMs - 10000,
        eventCount: 5, // Above STEADY_STATE_MIN_EVENTS
        nowMs,
      };
      expect(resolveRelayEvidenceConfidence(params)).toBe("steady_state");
    });

    it("returns partial_eose when EOSE + many events but still receiving", () => {
      const params: RelayEvidencePolicyParams = {
        subscriptionEstablishedAt: nowMs - 30000,
        lastEventReceivedAt: nowMs - 1000, // 1s ago (< 5s quiet)
        eoseReceivedAt: nowMs - 5000,
        eventCount: 10,
        nowMs,
      };
      expect(resolveRelayEvidenceConfidence(params)).toBe("partial_eose");
    });
  });

  describe("shouldRelaxThinnerSnapshotGuard", () => {
    it("relaxes guard for seed_only regardless of member count", () => {
      expect(shouldRelaxThinnerSnapshotGuard("seed_only", 1)).toBe(true);
      expect(shouldRelaxThinnerSnapshotGuard("seed_only", 5)).toBe(true);
      expect(shouldRelaxThinnerSnapshotGuard("seed_only", 10)).toBe(true);
    });

    it("relaxes guard for warming_up when current members <= 2", () => {
      expect(shouldRelaxThinnerSnapshotGuard("warming_up", 1)).toBe(true);
      expect(shouldRelaxThinnerSnapshotGuard("warming_up", 2)).toBe(true);
    });

    it("does NOT relax guard for warming_up when current members > 2", () => {
      expect(shouldRelaxThinnerSnapshotGuard("warming_up", 3)).toBe(false);
      expect(shouldRelaxThinnerSnapshotGuard("warming_up", 5)).toBe(false);
    });

    it("does NOT relax guard for partial_eose", () => {
      expect(shouldRelaxThinnerSnapshotGuard("partial_eose", 1)).toBe(false);
      expect(shouldRelaxThinnerSnapshotGuard("partial_eose", 5)).toBe(false);
    });

    it("does NOT relax guard for steady_state", () => {
      expect(shouldRelaxThinnerSnapshotGuard("steady_state", 1)).toBe(false);
      expect(shouldRelaxThinnerSnapshotGuard("steady_state", 5)).toBe(false);
    });
  });

  describe("formatRelayEvidenceConfidence", () => {
    it("formats seed_only state", () => {
      const params: RelayEvidencePolicyParams = {
        subscriptionEstablishedAt: null,
        lastEventReceivedAt: null,
        eoseReceivedAt: null,
        eventCount: 0,
        nowMs,
      };
      const formatted = formatRelayEvidenceConfidence("seed_only", params);
      expect(formatted).toContain("seed_only");
      expect(formatted).toContain("events=0");
    });

    it("formats warming_up state with timing", () => {
      const params: RelayEvidencePolicyParams = {
        subscriptionEstablishedAt: nowMs - 5000,
        lastEventReceivedAt: null,
        eoseReceivedAt: null,
        eventCount: 0,
        nowMs,
      };
      const formatted = formatRelayEvidenceConfidence("warming_up", params);
      expect(formatted).toContain("warming_up");
      expect(formatted).toContain("sub=5s");
    });

    it("formats steady_state with full timing", () => {
      const params: RelayEvidencePolicyParams = {
        subscriptionEstablishedAt: nowMs - 30000,
        lastEventReceivedAt: nowMs - 6000,
        eoseReceivedAt: nowMs - 10000,
        eventCount: 5,
        nowMs,
      };
      const formatted = formatRelayEvidenceConfidence("steady_state", params);
      expect(formatted).toContain("steady_state");
      expect(formatted).toContain("sub=30s");
      expect(formatted).toContain("eose=10s");
      expect(formatted).toContain("events=5");
    });
  });
});
