import { describe, expect, it, vi } from "vitest";

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: () => true,
  readMembershipSyncMode: () => "coordination_preferred",
}));

vi.mock("./community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: () => true,
}));

import {
  resolveCommunityControlTransportKind,
  usesCoordinationMembershipDirectory,
} from "./community-workspace-transport-policy";

describe("community-workspace-transport-policy", () => {
  it("selects team_relay for managed workspace on a private wss relay", () => {
    expect(
      resolveCommunityControlTransportKind({
        communityMode: "managed_workspace",
        communityRelayUrl: "wss://relay.example.com",
      }),
    ).toBe("team_relay");
  });

  it("falls back to nostr for public default relay hosts", () => {
    expect(
      resolveCommunityControlTransportKind({
        communityMode: "managed_workspace",
        communityRelayUrl: "wss://relay.damus.io",
      }),
    ).toBe("nostr");
  });

  it("uses coordination directory for managed_workspace", () => {
    expect(usesCoordinationMembershipDirectory("managed_workspace")).toBe(true);
    expect(usesCoordinationMembershipDirectory("sovereign_room")).toBe(false);
  });
});
