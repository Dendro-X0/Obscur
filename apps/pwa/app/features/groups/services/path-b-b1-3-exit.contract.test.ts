import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B1-3 exit contract — single useSealedCommunity instance policy across shell surfaces.
 */
describe("path B B1-3 exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("instance policy module owns surface enablement helpers", () => {
    const policy = read("app/features/groups/services/sealed-community-instance-policy.ts");
    expect(policy).toContain("Path B B1-3");
    expect(policy).toContain("resolveMainShellSealedCommunityEnabled");
    expect(policy).toContain("resolveGroupHomeSealedCommunityEnabled");
    expect(policy).toContain("resolveGroupManagementSealedCommunityEnabled");
    expect(policy).toContain("isGroupCommunityHomePathname");
  });

  it("main-shell uses instance policy instead of inline route guards", () => {
    const mainShell = read("app/features/main-shell/main-shell.tsx");
    expect(mainShell).toContain("resolveMainShellSealedCommunityEnabled");
    expect(mainShell).not.toContain("isGroupCommunityHomeRoute");
  });

  it("group-home uses group-home enablement policy", () => {
    const groupHome = read("app/groups/[...id]/group-home-page-client.tsx");
    expect(groupHome).toContain("resolveGroupHomeSealedCommunityEnabled");
    expect(groupHome).toContain("communityController={sealedCommunityController}");
  });

  it("management dialog avoids duplicate hook when parent controller is passed", () => {
    const dialog = read("app/features/groups/components/group-management-dialog.tsx");
    expect(dialog).toContain("resolveGroupManagementSealedCommunityEnabled");
    expect(dialog).toContain("communityController ?? internalCommunity");
  });

  it("chat route subtracts MainShell off `/` (route-exclusive with group-home)", () => {
    const chatRoute = read("app/features/runtime/components/chat-route-main-shell.tsx");
    const policy = read("app/features/groups/services/sealed-community-instance-policy.ts");
    expect(chatRoute).toContain('pathname === "/"');
    expect(policy).toContain("isChatRoutePathname");
    expect(policy).toContain("areSealedCommunityRouteSurfacesExclusive");
  });

  it("relay ingest shares sealedCommunityShellEnabled on both surfaces", () => {
    const mainShell = read("app/features/main-shell/main-shell.tsx");
    const groupHome = read("app/groups/[...id]/group-home-page-client.tsx");
    expect(mainShell).toMatch(/sealedCommunityShellEnabled[\s\S]*useGroupThreadRelayIngest/);
    expect(groupHome).toMatch(/sealedCommunityShellEnabled[\s\S]*useGroupThreadRelayIngest/);
  });
});
