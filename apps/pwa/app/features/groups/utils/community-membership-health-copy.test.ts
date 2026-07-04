import { describe, expect, it, vi } from "vitest";
import { resolveCommunityMembershipHealthSummary } from "./community-membership-health-copy";
import type { CommunityMembershipHealth } from "../services/community-membership-health";

const t = vi.fn((key: string) => key);

describe("resolveCommunityMembershipHealthSummary", () => {
  it("omits room_key_missing suffix when ready and chat enabled", () => {
    const health: CommunityMembershipHealth = {
      ready: true,
      chatEnabled: true,
      blockers: ["room_key_missing"],
      recoveryActions: ["invite_redemption"],
    };
    expect(resolveCommunityMembershipHealthSummary(health, t)).toBe(
      "groups.membershipHealth.summary.ready",
    );
  });

  it("keeps room_key_missing suffix when chat is disabled", () => {
    const health: CommunityMembershipHealth = {
      ready: true,
      chatEnabled: false,
      blockers: ["room_key_missing", "relay_not_writable"],
      recoveryActions: ["invite_redemption", "configure_relays"],
    };
    expect(resolveCommunityMembershipHealthSummary(health, t)).toBe(
      "groups.membershipHealth.blocker.relayNotWritable",
    );
  });
});
