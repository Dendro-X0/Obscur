import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B1-2 exit contract — sealed-community relay ingest is chat-only for workspace;
 * membership signals do not drive roster authority.
 */
describe("path B B1-2 exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("relay membership ingest policy blocks workspace roster authority", () => {
    const policy = read("app/features/groups/services/sealed-community-relay-membership-ingest-policy.ts");
    expect(policy).toContain("Path B B1-2");
    expect(policy).toContain("shouldIgnoreRelayMembershipSignalForSealedCommunity");
    expect(policy).toContain("resolveSealedCommunityRelaySubscribeKinds");
    expect(policy).toContain("shouldUseCoordinationMembershipAuthority");
  });

  it("chat-only subscribe kinds exist for managed_workspace", () => {
    const kinds = read("app/features/groups/services/sealed-community-relay-kinds.ts");
    expect(kinds).toContain("SEALED_COMMUNITY_CHAT_SUBSCRIBE_KINDS");
    expect(kinds).toContain("Path B B1-2");
    expect(kinds).not.toMatch(/SEALED_COMMUNITY_CHAT_SUBSCRIBE_KINDS[\s\S]*39002/);
  });

  it("group-thread relay ingest uses communityMode for subscription filters", () => {
    const ingest = read("app/features/groups/services/group-thread-relay-ingest.ts");
    expect(ingest).toContain("resolveSealedCommunityRelaySubscribeKinds");
    expect(ingest).toContain("communityMode?: CommunityMode | null");
    expect(ingest).toContain("unsupported_kind");
  });

  it("useGroupThreadRelayIngest passes communityMode into filters", () => {
    const hook = read("app/features/groups/hooks/use-group-thread-relay-ingest.ts");
    expect(hook).toContain("communityMode?: CommunityMode");
    expect(hook).toContain("buildGroupTimelineSubscriptionFilters(groupId, params.communityMode)");
  });

  it("use-sealed-community documents relay membership subtraction", () => {
    const sealed = read("app/features/groups/hooks/use-sealed-community.ts");
    expect(sealed).toContain("Path B B1-2");
    expect(sealed).toContain("useGroupThreadRelayIngest");
    expect(sealed).not.toContain("roster_seed");
  });

  it("main-shell and group-home wire communityMode into relay ingest", () => {
    const mainShell = read("app/features/main-shell/main-shell.tsx");
    const groupHome = read("app/groups/[...id]/group-home-page-client.tsx");
    expect(mainShell).toContain("useGroupThreadRelayIngest");
    expect(mainShell).toMatch(/communityMode:.*GroupConversation.*communityMode/s);
    expect(groupHome).toContain("communityMode: group?.communityMode");
  });
});
