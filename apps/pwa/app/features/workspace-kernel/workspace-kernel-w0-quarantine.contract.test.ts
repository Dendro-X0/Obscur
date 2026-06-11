import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WORKSPACE_KERNEL_LEGACY_ROUTING_FILES } from "./workspace-kernel-subtraction-manifest";

/**
 * W0 — legacy community surfaces must gate on workspace-kernel authority.
 */
describe("workspace-kernel W0 legacy routing quarantine", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("legacy routing surfaces gate workspace-kernel authority", () => {
    const combined = WORKSPACE_KERNEL_LEGACY_ROUTING_FILES.map(read).join("\n");
    expect(combined).toContain("isWorkspaceKernelAuthority");
    expect(combined).toContain("isWorkspaceCommunityCreateAllowed");
    expect(combined).toContain("resolveMainShellSealedCommunityEnabled");
  });

  it("sealed-community instance policy disables legacy hook when kernel authority is on", () => {
    const policy = read("app/features/groups/services/sealed-community-instance-policy.ts");
    expect(policy).toContain("isWorkspaceKernelAuthority");
    expect(policy).toMatch(/!isWorkspaceKernelAuthority\(\)/);
  });

  it("use-chat-actions defers to workspace-kernel write-port when kernel authority is on", () => {
    const chatActions = read("app/features/main-shell/hooks/use-chat-actions.ts");
    expect(chatActions).toContain("isWorkspaceKernelAuthority");
    expect(chatActions).toContain("sendWorkspaceKernelGroupMessage");
  });

  it("global-dialog-manager defers community create when workspace-kernel authority is on", () => {
    const dialogManager = read("app/features/messaging/components/global-dialog-manager.tsx");
    expect(dialogManager).toContain("isWorkspaceCommunityCreateAllowed");
    expect(dialogManager).toContain("WORKSPACE_KERNEL_CREATE_DEFERRED_MESSAGE");
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

  it("create-group-dialog blocks submit when workspace create is not allowed", () => {
    const createDialog = read("app/features/groups/components/create-group-dialog.tsx");
    expect(createDialog).toContain("isWorkspaceCommunityCreateAllowed");
    expect(createDialog).toContain('data-testid="create-group-workspace-kernel-deferred"');
    expect(createDialog).toContain("isNewSovereignRoomCreationAllowed");
  });

  it("community-legacy-sovereign-policy delegates sovereign create gate to workspace-kernel", () => {
    const legacy = read("app/features/groups/services/community-legacy-sovereign-policy.ts");
    expect(legacy).toContain("workspace-kernel-sovereign-create-policy");
  });
});
