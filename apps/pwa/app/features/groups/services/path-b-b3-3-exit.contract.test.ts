import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B3-3 exit contract — hydrate reads SQLite with multi-slot scan.
 */
describe("path B B3-3 exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("group sqlite store scans all account profile slots on hydrate", () => {
    const store = read("app/features/messaging/services/thread-history/group-thread-sqlite-store.ts");
    expect(store).toContain("listAccountSharedSqliteProfileIds");
    expect(store).toContain("mergeGroupMessageRecordsForPage");
    expect(store).toContain("readActiveDesktopProfileId");
    expect(store).toContain("loadGroupMessageRowsFromSqlite");
  });

  it("loadPersistedSealedGroupMessages passes resolved profile slot to sqlite hydrate", () => {
    const persistence = read("app/features/groups/services/sealed-group-message-persistence.ts");
    expect(persistence).toContain("resolveSealedGroupPersistenceProfileId");
    expect(persistence).toMatch(/loadGroupThreadPageFromSqlite\([\s\S]*profileId: resolveSealedGroupPersistenceProfileId/);
  });

  it("dm-kernel group port reads through multi-slot sqlite store", () => {
    const port = read("app/features/dm-kernel/dm-kernel-group-thread-port.ts");
    expect(port).toContain("loadGroupThreadPageFromSqlite");
  });

  it("sqlite store tests cover multi-slot merge", () => {
    const tests = read("app/features/messaging/services/thread-history/group-thread-sqlite-store.test.ts");
    expect(tests).toContain("multi-slot scan");
    expect(tests).toContain("mergeGroupMessageRecordsForPage");
  });

  it("verify path-b-b3-3 script exists", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:path-b-b3-3");
  });
});
