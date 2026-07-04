import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * W1 exit contract — membership-port wiring + COM-MEM gate script.
 */
describe("workspace-kernel W1 exit contract", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("verify:workspace-kernel-w1 script exists", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:workspace-kernel-w1");
  });

  it("global-dialog-manager routes create through membership-port when kernel authority is on", () => {
    const dialogManager = read("app/features/messaging/components/global-dialog-manager.tsx");
    expect(dialogManager).toContain("isWorkspaceKernelAuthority");
    expect(dialogManager).toContain("createManagedWorkspaceMembership");
  });

  it("group-join-dialog routes join through membership-port when kernel authority is on", () => {
    const joinDialog = read("app/features/groups/components/group-join-dialog.tsx");
    expect(joinDialog).toContain("joinManagedWorkspaceMembership");
    expect(joinDialog).toContain("isWorkspaceKernelAuthority");
  });

  it("leave page routes network leave through workspace-kernel leave-port", () => {
    const leavePage = read("app/groups/leave/page.tsx");
    expect(leavePage).toContain("publishWorkspaceKernelLeave");
    expect(leavePage).toContain("isWorkspaceKernelAuthority");
  });

  it("membership-port owns coordination directory refresh after create/join", () => {
    const membershipPort = read("app/features/workspace-kernel/workspace-kernel-membership-port.ts");
    expect(membershipPort).toContain("refreshCoordinationMembershipDirectory");
    expect(membershipPort).toContain("publishWorkspaceCoordinationJoinEvidence");
    expect(membershipPort).toContain("publishSelfCoordinationRoomKeyWrapAfterJoin");
    expect(membershipPort).not.toContain("use-sealed-community");
  });
});
