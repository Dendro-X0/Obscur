import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * U4 — sole join/leave orchestration under workspace-kernel authority.
 * @see specs/backend/community-u4-membership-write-collapse-design-2026-07.md
 */
describe("workspace-kernel U4 membership write collapse", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("leave port owns network + local commit API", () => {
    const leavePort = read("app/features/workspace-kernel/workspace-kernel-leave-port.ts");
    expect(leavePort).toContain("leaveManagedWorkspaceMembership");
    expect(leavePort).toContain("publishWorkspaceKernelLeave");
    expect(leavePort).toContain("commitCommunityLeaveAfterRelayConfirmation");
    expect(leavePort).toContain("removeWorkspaceGroupMetadata");
    const leaveFn = leavePort.slice(leavePort.indexOf("export const leaveManagedWorkspaceMembership"));
    expect(leaveFn.indexOf("publishWorkspaceKernelLeave"))
      .toBeLessThan(leaveFn.indexOf("commitCommunityLeaveAfterRelayConfirmation"));
  });

  it("leave page routes managed leave through leaveManagedWorkspaceMembership", () => {
    const leavePage = read("app/groups/leave/page.tsx");
    expect(leavePage).toContain("leaveManagedWorkspaceMembership");
  });

  it("group-provider has no join ledger write path (U4 Wave B)", () => {
    const provider = read("app/features/groups/providers/group-provider-legacy.tsx");
    const addGroupBlock = provider.slice(provider.indexOf("const addGroup = useCallback"));
    const addGroupEnd = addGroupBlock.indexOf("const updateGroup = useCallback");
    const addOnly = addGroupEnd >= 0 ? addGroupBlock.slice(0, addGroupEnd) : addGroupBlock;
    expect(addOnly).not.toContain("persistCommunityMembershipLedgerMutation");
  });

  it("group-provider leaveGroup does not commit ledger under kernel authority", () => {
    const provider = read("app/features/groups/providers/group-provider-legacy.tsx");
    const leaveGroupBlock = provider.slice(provider.indexOf("const leaveGroup = useCallback"));
    const kernelBranch = leaveGroupBlock.slice(
      leaveGroupBlock.indexOf("if (isWorkspaceKernelAuthority())"),
      leaveGroupBlock.indexOf("commitCommunityLeaveAfterRelayConfirmation"),
    );
    expect(kernelBranch).toContain("removeGroupConversation");
    expect(kernelBranch).not.toContain("commitCommunityLeaveAfterRelayConfirmation");
  });

  it("settings destructive leave uses leave port under kernel authority", () => {
    const settings = read(
      "app/settings/settings-tab-panel-models/use-settings-destructive-actions-model.ts",
    );
    expect(settings).toContain("leaveManagedWorkspaceMembership");
    expect(settings).toContain("isWorkspaceKernelAuthority");
  });

  it("join dialog and invite card keep membership-port join owner", () => {
    const joinDialog = read("app/features/groups/components/group-join-dialog.tsx");
    const inviteCard = read("app/features/groups/components/community-invite-card.tsx");
    expect(joinDialog).toContain("joinManagedWorkspaceMembership");
    expect(inviteCard).toContain("joinManagedWorkspaceMembership");
  });
});
