/**
 * REL-005 — One canonical live mutation owner for membership ledger writes.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { loadCommunityMembershipLedger } from "./community-membership-ledger";
import {
  applyCommunityMembershipLedgerMutations,
  applyCommunityMembershipRuntimeEvidence,
  COMMUNITY_MEMBERSHIP_MUTATION_OWNER_ID,
  persistExplicitCommunityMembershipLeave,
} from "./community-membership-mutation-owner";
import { resolveCommunityMembershipExplicitLeaveMutation } from "./community-membership-coordinator";

const { logAppEventMock } = vi.hoisted(() => ({
  logAppEventMock: vi.fn(),
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: logAppEventMock,
}));

const PUBLIC_KEY = "e".repeat(64) as PublicKeyHex;
const GROUP_ID = "rel005-group";
const RELAY_URL = "wss://relay.rel005.example";

const makeGroup = (): GroupConversation => ({
  kind: "group",
  id: `community:${GROUP_ID}:${RELAY_URL}`,
  communityId: `${GROUP_ID}:${RELAY_URL}`,
  groupId: GROUP_ID,
  relayUrl: RELAY_URL,
  displayName: "REL005",
  memberPubkeys: [PUBLIC_KEY],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(2_000),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
});

describe("REL-005 — community membership mutation owner", () => {
  beforeEach(() => {
    window.localStorage.clear();
    logAppEventMock.mockClear();
    setProfileScopeOverride("profile-rel005");
  });

  it("persistExplicitCommunityMembershipLeave writes terminal left via mutation owner", () => {
    persistExplicitCommunityMembershipLeave({
      publicKeyHex: PUBLIC_KEY,
      group: makeGroup(),
      profileId: "profile-rel005",
    });
    const ledger = loadCommunityMembershipLedger(PUBLIC_KEY, { profileId: "profile-rel005" });
    expect(ledger).toEqual(expect.arrayContaining([
      expect.objectContaining({ groupId: GROUP_ID, status: "left" }),
    ]));
    expect(logAppEventMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.membership_mutation_owner_committed",
      context: expect.objectContaining({
        owner: COMMUNITY_MEMBERSHIP_MUTATION_OWNER_ID,
        reason: "explicit_leave",
      }),
    }));
  });

  it("applyCommunityMembershipLedgerMutations commits coordinator mutations with owner diagnostics", () => {
    const mutation = resolveCommunityMembershipExplicitLeaveMutation({
      publicKeyHex: PUBLIC_KEY,
      group: makeGroup(),
    });
    applyCommunityMembershipLedgerMutations(PUBLIC_KEY, [mutation], { profileId: "profile-rel005" });
    expect(logAppEventMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.membership_mutation_owner_committed",
      context: expect.objectContaining({ reason: "explicit_leave" }),
    }));
  });

  it("applyCommunityMembershipRuntimeEvidence routes relay_gossip_ingress through coordinator + owner", () => {
    applyCommunityMembershipRuntimeEvidence({
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-rel005",
      evidence: {
        kind: "relay_gossip_ingress",
        group: makeGroup(),
        updatedAtUnixMs: 3_000,
        lastEvidenceEventId: "evt-rel005",
      },
      membershipLedger: [],
      tombstones: new Set(),
    });
    const ledger = loadCommunityMembershipLedger(PUBLIC_KEY, { profileId: "profile-rel005" });
    expect(ledger).toEqual(expect.arrayContaining([
      expect.objectContaining({ groupId: GROUP_ID, status: "joined" }),
    ]));
    expect(logAppEventMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.membership_mutation_owner_committed",
      context: expect.objectContaining({ reason: "runtime_join_confirmed" }),
    }));
  });
});
