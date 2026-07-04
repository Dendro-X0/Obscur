import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { DEV_LAB_ACCOUNTS } from "./dev-lab-accounts";
import {
  formatMembershipGraphLayerMessage,
  probeDevLabMembershipGraph,
} from "./dev-lab-membership-graph-probe";

vi.mock("./dev-lab-policy", () => ({
  isDevLabEnabled: vi.fn(() => true),
}));

vi.mock("@/app/features/workspace-kernel/workspace-kernel-policy", () => ({
  isWorkspaceKernelAuthority: vi.fn(() => false),
}));

vi.mock("@/app/features/messaging/services/request-flow-evidence-store", () => ({
  requestFlowEvidenceStore: {
    get: vi.fn(() => ({
      receiptAckSeen: false,
      acceptSeen: false,
    })),
  },
}));

vi.mock("@/app/features/groups/services/community-dm-invite-ledger", () => ({
  loadCommunityDmInviteLedger: vi.fn(() => []),
}));

describe("dev-lab-membership-graph-probe", () => {
  const tester1Hex = derivePublicKeyHex(DEV_LAB_ACCOUNTS.tester1.privateKeyHex!) as PublicKeyHex;
  const tester2Hex = (DEV_LAB_ACCOUNTS.tester2.publicKeyHex
    ?? derivePublicKeyHex(DEV_LAB_ACCOUNTS.tester2.privateKeyHex!)) as PublicKeyHex;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports layer0 failure when no social edge exists", () => {
    const result = probeDevLabMembershipGraph({
      actorPublicKeyHex: tester1Hex,
      peerPublicKeyHex: tester2Hex,
      profileId: "graph-probe-test",
    });
    const layer0 = result.layers.find((layer) => layer.layer === "layer0_social");
    expect(layer0?.ok).toBe(false);
    expect(layer0?.reason).toBe("no_social_edge");
    expect(result.failingLayer).toBe("layer0_social");
    expect(result.ok).toBe(false);
  });

  it("formats layer messages with layer id", () => {
    const message = formatMembershipGraphLayerMessage({
      layer: "layer2_workspace",
      ok: false,
      skipped: false,
      reason: "coordination_directory_missing_peer",
      details: {},
    });
    expect(message).toContain("Layer 2");
    expect(message).toContain("FAIL");
  });

  it("identifies tester1 actor account id", () => {
    const result = probeDevLabMembershipGraph({
      actorPublicKeyHex: tester1Hex,
      peerPublicKeyHex: tester2Hex,
    });
    expect(result.actorAccountId).toBe("tester1");
  });
});
