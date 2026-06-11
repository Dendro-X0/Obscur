import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * W3 exit contract — roster-port wiring + WorkspaceKernelProvider + COM-ROSTER gate script.
 */
describe("workspace-kernel W3 exit contract", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("verify:workspace-kernel-w3 script exists", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:workspace-kernel-w3");
  });

  it("unlocked runtime shell mounts WorkspaceKernelProvider inside GroupProvider", () => {
    const shell = read("app/features/runtime/components/unlocked-app-runtime-shell.tsx");
    expect(shell).toContain("WorkspaceKernelProvider");
    expect(shell).toMatch(/<GroupProvider>[\s\S]*<WorkspaceKernelProvider>/);
  });

  it("group-provider builds roster index from workspace-kernel roster hook", () => {
    const provider = read("app/features/groups/providers/group-provider.tsx");
    expect(provider).toContain("useWorkspaceKernelRosterIndex");
    expect(provider).toContain("isWorkspaceKernelAuthority");
    expect(provider).toMatch(/isWorkspaceKernelAuthority\(\)[\s\S]*workspaceKernelRosterByConversationId/);
  });

  it("main-shell subtracts sealed-community roster merge when kernel authority is on", () => {
    const mainShell = read("app/features/main-shell/main-shell.tsx");
    expect(mainShell).toContain("resolveWorkspaceKernelActiveMemberPubkeys");
    expect(mainShell).toMatch(/isWorkspaceKernelAuthority\(\)[\s\S]*resolveWorkspaceKernelActiveMemberPubkeys/);
  });

  it("group-home reads coordination roster when kernel authority is on", () => {
    const groupHome = read("app/groups/[...id]/group-home-page-client.tsx");
    expect(groupHome).toContain("resolveWorkspaceKernelActiveMemberPubkeys");
    expect(groupHome).toMatch(/isWorkspaceKernelAuthority\(\)[\s\S]*resolveWorkspaceKernelActiveMemberPubkeys/);
  });

  it("workspace-kernel provider exposes roster from GroupProvider without duplicate hook", () => {
    const kernelProvider = read("app/features/workspace-kernel/workspace-kernel-provider.tsx");
    expect(kernelProvider).toContain("useGroups");
    expect(kernelProvider).toContain("communityRosterByConversationId");
    expect(kernelProvider).not.toContain("useWorkspaceKernelRosterIndex");
  });
});
