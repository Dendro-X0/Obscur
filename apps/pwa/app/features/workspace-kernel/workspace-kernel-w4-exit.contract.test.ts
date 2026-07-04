import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * W4 exit contract — backup-restore scope register + B4 delegation + settings copy.
 */
describe("workspace-kernel W4 exit contract", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("verify:workspace-kernel-w4 script exists", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:workspace-kernel-w4");
  });

  it("manifest documents W4 scope register", () => {
    const manifest = readFileSync(
      path.join(repoRoot, "docs/program/workspace-kernel-manifest.md"),
      "utf8",
    );
    expect(manifest).toContain("W4");
    expect(manifest).toMatch(/W4.*Landed/i);
  });

  it("program manifest documents W4 landed and workspace kernel complete", () => {
    const manifest = readFileSync(
      path.join(repoRoot, "docs/program/workspace-kernel-manifest.md"),
      "utf8",
    );
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(manifest).toContain("verify:workspace-kernel-w4");
    expect(manifest).toMatch(/Workspace kernel W1–W4.*Complete|W4.*Landed/i);
    expect(pkg).toContain("verify:workspace-kernel");
  });

  it("backup-restore port delegates to Path B B4 native sqlite evidence", () => {
    const port = read("app/features/workspace-kernel/workspace-kernel-backup-restore-port.ts");
    expect(port).toContain("collectNativeSqliteBackupEvidence");
    expect(port).toContain("applyNativeRestoreSqliteMaterialization");
    expect(port).not.toContain("use-sealed-community");
  });

  it("scope register defers coordination directory with user copy keys", () => {
    const scope = read("app/features/workspace-kernel/workspace-kernel-backup-restore-scope.ts");
    expect(scope).toContain("WORKSPACE_KERNEL_BACKUP_RESTORE_SCOPE_REGISTER");
    expect(scope).toContain("coordination_membership_directory");
    expect(scope).toMatch(/status:\s*"deferred"[\s\S]*coordination_membership_directory|coordination_membership_directory[\s\S]*status:\s*"deferred"/);
    expect(scope).toContain("userCopyKey");
  });

  it("profile settings surfaces workspace backup scope notice", () => {
    const settings = read("app/settings/panels/profile-settings-tab-panel.tsx");
    expect(settings).toContain("WorkspaceKernelBackupRestoreScopeNotice");
  });
});
