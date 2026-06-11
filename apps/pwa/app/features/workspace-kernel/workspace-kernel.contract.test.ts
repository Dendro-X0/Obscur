import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  WORKSPACE_KERNEL_FORBIDDEN_KERNEL_IMPORTS,
  WORKSPACE_KERNEL_IMPLEMENTATION_FILES,
} from "./workspace-kernel-subtraction-manifest";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";
import { isNewSovereignRoomCreationAllowed, isWorkspaceCommunityCreateAllowed } from "./workspace-kernel-sovereign-create-policy";
import { assertWorkspaceLeaveRequiresRelayConfirmation } from "./workspace-kernel-leave-port";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@/app/features/groups/services/community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => false),
}));

describe("workspace-kernel policy", () => {
  it("is active on native runtime by default", () => {
    expect(isWorkspaceKernelAuthority()).toBe(true);
  });

  it("blocks sovereign room creation", () => {
    expect(isNewSovereignRoomCreationAllowed()).toBe(false);
  });

  it("defers managed workspace create when coordination is not configured", () => {
    expect(isWorkspaceCommunityCreateAllowed()).toBe(false);
  });
});

describe("workspace-kernel leave-port contract", () => {
  it("rejects local commit without relayConfirmed", () => {
    expect(() => assertWorkspaceLeaveRequiresRelayConfirmation(false)).toThrow(/relayConfirmed required/);
    expect(() => assertWorkspaceLeaveRequiresRelayConfirmation(true)).not.toThrow();
  });
});

describe("workspace-kernel quarantine", () => {
  const kernelDir = path.resolve(__dirname);

  it("kernel implementation files do not import legacy community authority modules", () => {
    const combined = WORKSPACE_KERNEL_IMPLEMENTATION_FILES
      .map((file) => readFileSync(path.join(kernelDir, file), "utf8"))
      .join("\n");
    for (const token of WORKSPACE_KERNEL_FORBIDDEN_KERNEL_IMPORTS) {
      expect(combined).not.toContain(token);
    }
  });

  it("manifest documents W0 subtraction targets", () => {
    const manifest = readFileSync(
      path.resolve(__dirname, "../../../../../docs/program/workspace-kernel-manifest.md"),
      "utf8",
    );
    expect(manifest).toContain("W0");
    expect(manifest).toContain("mergeHybridMembershipTruthFallback");
    expect(manifest).toContain("verify:workspace-kernel-w0");
  });
});
