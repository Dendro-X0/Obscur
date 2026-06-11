import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B4 exit contract — native backup/restore sqlite evidence.
 */
describe("path B B4 exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("B4-1: backup publish collects native sqlite evidence on tauri", () => {
    const backup = read("app/features/account-sync/services/encrypted-account-backup-service.ts");
    const evidence = read("app/features/account-sync/services/native-sqlite-backup-evidence.ts");
    expect(evidence).toContain("collectNativeSqliteBackupEvidence");
    expect(evidence).toContain("dbGetMessages");
    expect(evidence).toContain("dbGetGroupMessages");
    expect(backup).toContain("collectNativeSqliteBackupEvidence");
    expect(backup).toContain("nativeSqliteEvidence");
  });

  it("B4-2: restore writes community-group-sqlite-store from chat-state groups", () => {
    const store = read("app/features/groups/services/community-group-sqlite-store.ts");
    const materialization = read("app/features/account-sync/services/native-sqlite-backup-evidence.ts");
    expect(store).toContain("syncPersistedGroupsToSqliteFromChatState");
    expect(materialization).toContain("applyNativeRestoreSqliteMaterialization");
    expect(materialization).toContain("syncPersistedGroupsToSqliteFromChatState");
  });

  it("restore materialization applies native sqlite rows after chat-state replace", () => {
    const restore = read("app/features/account-sync/services/restore-materialization.ts");
    const backup = read("app/features/account-sync/services/encrypted-account-backup-service.ts");
    expect(restore).toContain("applyNativeRestoreSqliteMaterialization");
    expect(backup).toContain("applyNativeRestoreSqliteMaterialization");
  });

  it("backup payload contract includes nativeSqliteEvidence field", () => {
    const contracts = read("app/features/account-sync/account-sync-contracts.ts");
    expect(contracts).toContain("NativeSqliteBackupEvidenceSnapshot");
    expect(contracts).toContain("nativeSqliteEvidence?: NativeSqliteBackupEvidenceSnapshot");
  });

  it("verify path-b-b4 script exists", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:path-b-b4");
  });
});
