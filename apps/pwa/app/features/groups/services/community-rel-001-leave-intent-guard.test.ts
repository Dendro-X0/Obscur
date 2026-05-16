/**
 * REL-001 — Left community must not resurrect from stale persisted chat-state
 * when durable leave intent exists without a joined ledger row.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { GroupConversation } from "@/app/features/messaging/types";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { resolveCommunityMembershipCoordinator } from "./community-membership-coordinator";
import { enqueueCommunityLeaveOutboxItem } from "./community-leave-outbox";
import { hasDurableCommunityLeaveIntent } from "./community-membership-leave-intent";
import { resolveCommunityMembershipRecovery } from "./community-membership-recovery";

const PUBLIC_KEY = "a".repeat(64);
const GROUP_ID = "rel001-group";
const RELAY_URL = "wss://relay.rel001.example";
const PROFILE_ID = "profile-rel001";

const makeGroup = (): GroupConversation => ({
  kind: "group",
  id: `community:${GROUP_ID}:${RELAY_URL}`,
  communityId: `${GROUP_ID}:${RELAY_URL}`,
  groupId: GROUP_ID,
  relayUrl: RELAY_URL,
  displayName: "REL001",
  memberPubkeys: [PUBLIC_KEY],
  lastMessage: "stale",
  unreadCount: 0,
  lastMessageTime: new Date(5_000),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
});

describe("REL-001 — leave intent blocks persisted_fallback resurrection", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfileScopeOverride(PROFILE_ID);
  });

  it("hasDurableCommunityLeaveIntent is true when leave outbox has pending item", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      profileId: PROFILE_ID,
    });
    expect(hasDurableCommunityLeaveIntent({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      tombstones: new Set(),
    })).toBe(true);
  });

  it("recovery hides persisted group when leave outbox exists but ledger is empty", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      profileId: PROFILE_ID,
    });
    const recovery = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [makeGroup()],
      membershipLedger: [],
      tombstones: new Set(),
    });
    expect(recovery.groups).toHaveLength(0);
    expect(recovery.diagnostics.hiddenByLeaveIntentCount).toBe(1);
    expect(recovery.missingLedgerCoverageEntries).toHaveLength(0);
  });

  it("coordinator does not emit persisted_fallback_backfill when leave outbox blocks recovery", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      profileId: PROFILE_ID,
    });
    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [makeGroup()],
      membershipLedger: [],
      tombstones: new Set(),
    });
    expect(result.groups).toHaveLength(0);
    expect(result.ledgerMutations.filter((m) => m.reason === "persisted_fallback_backfill")).toHaveLength(0);
  });
});
