import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SemanticCommunityMemberEvent } from "@dweb/transport-contracts";

const fetchHead = vi.hoisted(() => vi.fn());
const fetchDeltas = vi.hoisted(() => vi.fn());
const loadCursor = vi.hoisted(() => vi.fn());
const saveCursor = vi.hoisted(() => vi.fn());

vi.mock("./community-coordination-membership-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./community-coordination-membership-client")>();
  return {
    ...actual,
    fetchCoordinationMembershipHead: fetchHead,
    fetchCoordinationMembershipDeltasSince: fetchDeltas,
  };
});

vi.mock("./community-coordination-membership-cursor", () => ({
  loadCoordinationMembershipSeqCursor: loadCursor,
  saveCoordinationMembershipSeqCursor: saveCursor,
}));

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: () => true,
}));

import { runCoordinationMembershipReconcile } from "./community-coordination-membership-reconcile";

describe("runCoordinationMembershipReconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchHead.mockResolvedValue({ communityId: "c1", seq: 2, headHash: "h", updatedAtUnixMs: 1 });
    loadCursor.mockReturnValue(0);
  });

  it("applies leave delta from coordination (K-M1 directory path)", async () => {
    const subject = "aa".repeat(32);
    fetchDeltas.mockResolvedValue({
      ok: true,
      deltas: [{
        deltaId: "d1",
        communityId: "c1",
        seq: 1,
        action: "leave",
        subjectPubkey: subject,
        actorPubkey: subject,
        createdAtUnixMs: 1000,
        signature: "sig",
      }],
    });
    const applied: SemanticCommunityMemberEvent[] = [];
    const result = await runCoordinationMembershipReconcile({
      communityId: "c1",
      forceFull: true,
      onSemanticMemberEvent: (event) => {
        applied.push(event);
      },
    });
    expect(result.ok).toBe(true);
    expect(result.appliedDeltaCount).toBe(1);
    expect(applied[0]?.type).toBe("COMMUNITY_MEMBER_LEFT");
    expect(applied[0]?.subjectPublicKeyHex).toBe(subject);
    expect(saveCursor).toHaveBeenCalledWith("c1", 1, undefined);
  });

  it("returns error when coordination fetch fails", async () => {
    fetchDeltas.mockResolvedValue({ ok: false, status: 503, error: "http_503" });
    const result = await runCoordinationMembershipReconcile({
      communityId: "c1",
      onSemanticMemberEvent: () => {},
    });
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toBe("http_503");
  });
});
