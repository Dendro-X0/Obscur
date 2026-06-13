import { describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  buildDevLabAuthScopeFingerprint,
  compareDevLabMembershipScopeSnapshots,
  probeDevLabMembershipScope,
} from "./dev-lab-membership-scope-probe";

vi.mock("./dev-lab-policy", () => ({
  isDevLabEnabled: vi.fn(() => true),
}));

vi.mock("@/app/features/workspace-kernel/workspace-kernel-policy", () => ({
  isWorkspaceKernelAuthority: vi.fn(() => false),
}));

vi.mock("@/app/features/groups/services/community-leave-outbox", () => ({
  readCommunityLeaveOutbox: vi.fn(() => []),
}));

describe("dev-lab-membership-scope-probe", () => {
  it("builds stable fingerprints for identical snapshots", () => {
    const snapshot = probeDevLabMembershipScope({
      publicKeyHex: "cc".repeat(32) as PublicKeyHex,
      profileId: "probe-test",
    });
    expect(buildDevLabAuthScopeFingerprint(snapshot)).toBe(
      buildDevLabAuthScopeFingerprint(snapshot),
    );
  });

  it("detects scope drift on reload comparison", () => {
    const before = probeDevLabMembershipScope({
      publicKeyHex: "cc".repeat(32) as PublicKeyHex,
      profileId: "probe-test",
    });
    const after = {
      ...before,
      leaveOutboxCount: before.leaveOutboxCount + 1,
    };
    const comparison = compareDevLabMembershipScopeSnapshots(before, after);
    expect(comparison.stable).toBe(false);
    expect(comparison.issues.some((issue) => issue.includes("leave_outbox"))).toBe(true);
  });
});
