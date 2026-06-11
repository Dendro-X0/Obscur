import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveSealedCommunityRelaySubscribeKinds,
  shouldIgnoreRelayMembershipSignalForSealedCommunity,
} from "./sealed-community-relay-membership-ingest-policy";
import {
  SEALED_COMMUNITY_CHAT_SUBSCRIBE_KINDS,
  SEALED_COMMUNITY_KIND_MEMBERS,
  SEALED_COMMUNITY_TIMELINE_SUBSCRIBE_KINDS,
} from "./sealed-community-relay-kinds";

vi.mock("./community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
  readMembershipSyncMode: vi.fn(() => "coordination_preferred" as const),
}));

describe("sealed-community-relay-membership-ingest-policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores relay membership signals for managed_workspace (Path B B1-2)", () => {
    expect(shouldIgnoreRelayMembershipSignalForSealedCommunity({
      communityMode: "managed_workspace",
    })).toBe(true);
    expect(shouldIgnoreRelayMembershipSignalForSealedCommunity({
      communityMode: "sovereign_room",
    })).toBe(false);
  });

  it("subscribes to chat-only kinds for managed_workspace", () => {
    const kinds = resolveSealedCommunityRelaySubscribeKinds("managed_workspace");
    expect(kinds).toEqual([...SEALED_COMMUNITY_CHAT_SUBSCRIBE_KINDS]);
    expect(kinds).not.toContain(SEALED_COMMUNITY_KIND_MEMBERS);
  });

  it("subscribes to full timeline kinds for sovereign_room", () => {
    const kinds = resolveSealedCommunityRelaySubscribeKinds("sovereign_room");
    expect(kinds).toEqual([...SEALED_COMMUNITY_TIMELINE_SUBSCRIBE_KINDS]);
    expect(kinds).toContain(SEALED_COMMUNITY_KIND_MEMBERS);
  });
});
