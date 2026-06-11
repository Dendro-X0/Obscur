import { beforeEach, describe, expect, it } from "vitest";
import type { GroupConversation } from "@/app/features/messaging/types";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { enqueueCommunityLeaveOutboxItem } from "./community-leave-outbox";
import { loadCommunityMembershipLedger, saveCommunityMembershipLedger } from "./community-membership-ledger";
import { addGroupTombstone, loadGroupTombstones } from "./group-tombstone-store";
import { hasDurableCommunityLeaveIntent } from "./community-membership-leave-intent";
import { repairCommunityMembershipDurableStateOnHydrate } from "./community-membership-hydrate-repair";
import { resolveCommunityMembershipRecovery } from "./community-membership-recovery";

const PUBLIC_KEY = "a".repeat(64);
const GROUP_ID = "test-9";
const RELAY_LEAVE = "WS://LOCALHOST:7000";
const RELAY_JOIN = "ws://localhost:7000";
const PROFILE_ID = "profile-hydrate-repair";

const makeGroup = (): GroupConversation => ({
  kind: "group",
  id: `community:${GROUP_ID}:${RELAY_JOIN}`,
  communityId: `${GROUP_ID}:${RELAY_JOIN}`,
  groupId: GROUP_ID,
  relayUrl: RELAY_JOIN,
  displayName: "Test 9",
  memberPubkeys: [PUBLIC_KEY],
  lastMessage: "hello",
  unreadCount: 0,
  lastMessageTime: new Date(8_000),
  access: "invite-only",
  memberCount: 2,
  adminPubkeys: [],
});

describe("community membership hydrate repair", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfileScopeOverride(PROFILE_ID);
  });

  it("clears legacy relay-cased hide gates when ledger is joined", () => {
    saveCommunityMembershipLedger(PUBLIC_KEY, [{
      groupId: GROUP_ID,
      relayUrl: RELAY_JOIN,
      status: "joined",
      updatedAtUnixMs: 9_000,
    }], { profileId: PROFILE_ID });
    addGroupTombstone(PUBLIC_KEY, { groupId: GROUP_ID, relayUrl: RELAY_LEAVE }, { profileId: PROFILE_ID });
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_LEAVE,
      profileId: PROFILE_ID,
    });

    repairCommunityMembershipDurableStateOnHydrate({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
    });

    expect(loadGroupTombstones(PUBLIC_KEY, { profileId: PROFILE_ID }).size).toBe(0);
    expect(hasDurableCommunityLeaveIntent({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      groupId: GROUP_ID,
      relayUrl: RELAY_JOIN,
      ledgerEntry: { groupId: GROUP_ID, relayUrl: RELAY_JOIN, status: "joined", updatedAtUnixMs: 9_000 },
      tombstones: loadGroupTombstones(PUBLIC_KEY, { profileId: PROFILE_ID }),
    })).toBe(false);
  });

  it("revives persisted group evidence when ledger stayed left after live rejoin", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_LEAVE,
      profileId: PROFILE_ID,
    });
    saveCommunityMembershipLedger(PUBLIC_KEY, [{
      groupId: GROUP_ID,
      relayUrl: RELAY_JOIN,
      status: "left",
      updatedAtUnixMs: 5_000,
    }], { profileId: PROFILE_ID });

    const group = makeGroup();
    repairCommunityMembershipDurableStateOnHydrate({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [group],
    });

    const ledger = loadCommunityMembershipLedger(PUBLIC_KEY, { profileId: PROFILE_ID });
    expect(ledger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: GROUP_ID,
        status: "joined",
      }),
    ]));
    const recovery = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [group],
      membershipLedger: ledger,
      tombstones: loadGroupTombstones(PUBLIC_KEY, { profileId: PROFILE_ID }),
    });
    expect(recovery.groups).toHaveLength(1);
    expect(recovery.diagnostics.hiddenByLeaveIntentCount).toBe(0);
  });
});
