import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildFindInCommunitySections } from "../services/community-find-in-community-sections";

const repoRoot = path.resolve(__dirname, "../../../../../../");
const read = (rel: string): string => readFileSync(path.join(repoRoot, rel), "utf8");

describe("U5 Find in community — Wave A", () => {
  it("sections prefer recent authors then connections without inventing members", () => {
    const sections = buildFindInCommunitySections({
      visiblePubkeys: ["aa", "bb", "cc", "dd"],
      authorEvidencePubkeys: ["bb", "zz"],
      acceptedPeers: ["cc" as never, "aa" as never],
      selfPubkey: "self" as never,
      matchesSearch: () => true,
      sectionCap: 50,
    });
    expect(sections.recentInChat).toEqual(["bb"]);
    expect(sections.connectionsHere).toEqual(["aa", "cc"]);
    expect(sections.everyoneElse).toEqual(["dd"]);
  });

  it("picker exists and does not mount reconcile / Online-Offline columns", () => {
    const picker = read(
      "apps/pwa/app/features/groups/components/community-find-in-community-picker.tsx",
    );
    const home = read("apps/pwa/app/groups/[...id]/group-home-page-client.tsx");
    expect(picker).toContain("CommunityFindInCommunityPicker");
    expect(picker).not.toMatch(/CommunityMembershipEvidenceToolbar/);
    expect(picker).not.toMatch(/participantsModal\.online/);
    expect(picker).not.toMatch(/participantsModal\.offline/);
    expect(picker).toContain("findInCommunity.title");
    expect(home).toContain("CommunityFindInCommunityPicker");
    expect(home).not.toContain("participantsModal.online");
    expect(home).not.toContain("participantsModal.offline");
    expect(home).not.toContain("CommunityMembershipEvidenceToolbar");
  });

  it("Wave B header metrics owner + chat header online-here copy", () => {
    const metrics = read(
      "apps/pwa/app/features/groups/services/community-header-member-metrics.ts",
    );
    const header = read(
      "apps/pwa/app/features/messaging/components/chat-header.tsx",
    );
    const shell = read("apps/pwa/app/features/main-shell/main-shell.tsx");
    expect(metrics).toContain("resolveCommunityHeaderMemberMetrics");
    expect(header).toContain("groupOnlineHereCount");
    expect(header).not.toMatch(/groupOnlineCount,\s*\{\s*count: groupOnlineMemberCount/);
    expect(shell).toContain("resolveCommunityHeaderMemberMetrics");
    expect(shell).not.toMatch(/Math\.max\(1, activeCount, r2Count/);
  });
});
