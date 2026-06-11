import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B2-3 exit contract — group-management dialog has no raw REQ/CLOSE;
 * profile name wire uses scoped hook owner.
 */
describe("path B B2-3 exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("group-management-dialog delegates relay REQ/CLOSE to display-names hook", () => {
    const dialog = read("app/features/groups/components/group-management-dialog.tsx");
    expect(dialog).toContain("useCommunityMemberDisplayNames");
    expect(dialog).not.toContain('sendToOpen(JSON.stringify(["REQ"');
    expect(dialog).not.toContain('sendToOpen(JSON.stringify(["CLOSE"');
    expect(dialog).not.toContain("subscribeToMessages");
  });

  it("display-names hook owns ephemeral kind-0 subscription", () => {
    const hook = read("app/features/groups/hooks/use-community-member-display-names.ts");
    expect(hook).toContain("Path B B2");
    expect(hook).toContain('JSON.stringify(["REQ", subId, filter])');
    expect(hook).toContain('JSON.stringify(["CLOSE", subId])');
    expect(hook).toContain("Does not compete with");
  });

  it("hook tests cover REQ/CLOSE lifecycle", () => {
    const tests = read("app/features/groups/hooks/use-community-member-display-names.test.ts");
    expect(tests).toContain("Path B B2-3");
    expect(tests).toContain('"CLOSE"');
  });

  it("group-home passes communityController to avoid duplicate sealed-community hook", () => {
    const groupHome = read("app/groups/[...id]/group-home-page-client.tsx");
    expect(groupHome).toContain("communityController={sealedCommunityController}");
  });

  it("verify path-b-b2 includes B2-3 gate", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:path-b-b2-3");
  });
});
