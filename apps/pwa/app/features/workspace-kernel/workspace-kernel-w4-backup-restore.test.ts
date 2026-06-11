import { describe, expect, it, vi } from "vitest";
import { evaluateComBkpWorkspaceScopeGate } from "./workspace-kernel-com-bkp-gate";
import {
  isWorkspaceKernelBackupRestoreScopeActive,
  listWorkspaceKernelBackupRestoreDeferredScope,
  listWorkspaceKernelBackupRestoreIncludedScope,
  workspaceKernelBackupRestoreScopeStatus,
} from "./workspace-kernel-backup-restore-scope";
import {
  isWorkspaceKernelBackupRestorePortReady,
  workspaceKernelBackupRestorePortStatus,
} from "./workspace-kernel-backup-restore-port";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

describe("workspace-kernel COM-BKP gate", () => {
  it("passes scope register with included thread+list and deferred coordination", () => {
    const result = evaluateComBkpWorkspaceScopeGate();
    expect(result.passed).toBe(true);
    expect(result.reason).toBe("com_bkp_ok");
    expect(result.includedIds).toEqual(expect.arrayContaining([
      "room_list",
      "thread_messages",
      "group_sqlite_metadata",
    ]));
    expect(result.deferredIds).toContain("coordination_membership_directory");
  });
});

describe("workspace-kernel backup-restore scope register", () => {
  it("documents included and deferred scopes with user copy keys", () => {
    expect(workspaceKernelBackupRestoreScopeStatus()).toBe("w4_landed");
    expect(isWorkspaceKernelBackupRestoreScopeActive()).toBe(true);
    expect(listWorkspaceKernelBackupRestoreIncludedScope().length).toBeGreaterThanOrEqual(3);
    expect(listWorkspaceKernelBackupRestoreDeferredScope().every((item) => item.userCopyKey.length > 0)).toBe(true);
  });
});

describe("workspace-kernel backup-restore port readiness", () => {
  it("is ready when workspace-kernel authority is on", () => {
    expect(workspaceKernelBackupRestorePortStatus()).toBe("w4_landed");
    expect(isWorkspaceKernelBackupRestorePortReady()).toBe(true);
  });
});
