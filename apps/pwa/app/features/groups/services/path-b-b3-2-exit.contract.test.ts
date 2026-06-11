import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B3-2 exit contract — awaited commit with correct profile slot at write.
 */
describe("path B B3-2 exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("sealed-group persistence resolves desktop profile slot at commit", () => {
    const persistence = read("app/features/groups/services/sealed-group-message-persistence.ts");
    expect(persistence).toContain("resolveSealedGroupPersistenceProfileId");
    expect(persistence).toContain("readActiveDesktopProfileId");
    expect(persistence).toContain("trackPendingSqliteWrite");
    expect(persistence).toMatch(/await trackPendingSqliteWrite\(writeTask\)/);
  });

  it("use-chat-actions delegates profile slot to commit owner", () => {
    const chatActions = read("app/features/main-shell/hooks/use-chat-actions.ts");
    expect(chatActions).toContain("await commitSealedGroupMessages");
    expect(chatActions).not.toContain("readActiveDesktopProfileId");
    const commitCall = chatActions.match(/await commitSealedGroupMessages\([\s\S]*?\}\);/);
    expect(commitCall?.[0]).toBeTruthy();
    expect(commitCall![0]).not.toContain("profileId:");
  });

  it("durability owner flushes pending sqlite writes on pagehide", () => {
    const owner = read("app/features/groups/components/sealed-group-message-durability-owner.tsx");
    expect(owner).toContain("flushPendingSealedGroupSqliteWrites");
    expect(owner).toContain("pagehide");
  });

  it("persistence tests cover profile slot resolution and flush", () => {
    const tests = read("app/features/groups/services/sealed-group-message-persistence.test.ts");
    expect(tests).toContain("desktop window profile slot");
    expect(tests).toContain("flushPendingSealedGroupSqliteWrites");
  });

  it("verify path-b-b3-2 script exists", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:path-b-b3-2");
  });
});
