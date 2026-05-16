import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { resolveEnhancedSnapshotApplication } from "./community-member-snapshot-policy";

describe("community-member-snapshot-policy", () => {
  const nowMs = 1_000_000;
  const seedOnlyEvidence = {
    subscriptionEstablishedAt: null as number | null,
    lastEventReceivedAt: null as number | null,
    eoseReceivedAt: null as number | null,
    eventCount: 0,
    nowMs,
  };

  const pk = (byte: string): PublicKeyHex => (`${byte.repeat(64)}` as PublicKeyHex);

  it("does not relax a thinner relay snapshot when it would drop a protected member", () => {
    const pkA = pk("a");
    const pkB = pk("b");

    const result = resolveEnhancedSnapshotApplication({
      currentMemberPubkeys: [pkA, pkB],
      incomingActiveMemberPubkeys: [pkA],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      protectRemovalPubkeys: [pkB],
      relayEvidenceParams: seedOnlyEvidence,
      sourceHint: "relay_snapshot",
    });

    expect(result.guardRelaxed).toBe(false);
    expect(result.application.shouldApply).toBe(false);
    expect(result.application.reasonCode).toBe("missing_removal_evidence");
    expect(result.application.nextMemberPubkeys).toEqual([pkA, pkB]);
    expect(result.reasonCode).toBe("relay_evidence_relax_blocked_protected_member");
  });

  it("still relaxes when removed members are not in the protection set", () => {
    const pkA = pk("a");
    const pkB = pk("b");
    const pkC = pk("c");

    const result = resolveEnhancedSnapshotApplication({
      currentMemberPubkeys: [pkA, pkB, pkC],
      incomingActiveMemberPubkeys: [pkA, pkB],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      protectRemovalPubkeys: [pkA, pkB],
      relayEvidenceParams: seedOnlyEvidence,
      sourceHint: "relay_snapshot",
    });

    expect(result.guardRelaxed).toBe(true);
    expect(result.application.shouldApply).toBe(true);
    expect(result.application.reasonCode).toBe("apply_snapshot_guard_relaxed");
    expect(result.application.nextMemberPubkeys).toEqual([pkA, pkB, pkC]);
    expect(result.reasonCode).toBe("relay_evidence_seed_only_allowing_thinner");
  });

  it("uses strict policy reason when warming_up rejects a thinner snapshot for larger rosters", () => {
    const pkA = pk("a");
    const pkB = pk("b");
    const pkC = pk("c");
    const relayEvidenceParams = {
      subscriptionEstablishedAt: nowMs - 5000,
      lastEventReceivedAt: null,
      eoseReceivedAt: null,
      eventCount: 0,
      nowMs,
    };

    const result = resolveEnhancedSnapshotApplication({
      currentMemberPubkeys: [pkA, pkB, pkC],
      incomingActiveMemberPubkeys: [pkA, pkB],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      protectRemovalPubkeys: [pkA, pkB, pkC],
      relayEvidenceParams,
      sourceHint: "relay_snapshot",
    });

    expect(result.confidence).toBe("warming_up");
    expect(result.guardRelaxed).toBe(false);
    expect(result.application.reasonCode).toBe("missing_removal_evidence");
    expect(result.reasonCode).toBe("relay_evidence_warming_up_strict");
  });

  it("uses strict policy reason for partial_eose when thinner snapshots are rejected", () => {
    const pkA = pk("a");
    const pkB = pk("b");
    const relayEvidenceParams = {
      subscriptionEstablishedAt: nowMs - 15000,
      lastEventReceivedAt: nowMs - 2000,
      eoseReceivedAt: nowMs - 3000,
      eventCount: 2,
      nowMs,
    };

    const result = resolveEnhancedSnapshotApplication({
      currentMemberPubkeys: [pkA, pkB],
      incomingActiveMemberPubkeys: [pkA],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      protectRemovalPubkeys: [pkA],
      relayEvidenceParams,
      sourceHint: "relay_snapshot",
    });

    expect(result.confidence).toBe("partial_eose");
    expect(result.guardRelaxed).toBe(false);
    expect(result.application.reasonCode).toBe("missing_removal_evidence");
    expect(result.reasonCode).toBe("relay_evidence_partial_eose_strict");
  });
});
