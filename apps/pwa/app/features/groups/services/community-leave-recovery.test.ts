import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import { toPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";
import {
  canRevokeCommunityLeaveTerminalState,
  listRejectedCommunityLeaveOutboxItems,
  restoreRejectedCommunityLeaveIntents,
  revokeCommunityLeaveTerminalState,
} from "./community-leave-recovery";
import {
  enqueueCommunityLeaveOutboxItem,
  readCommunityLeaveOutbox,
  recordCommunityLeaveRelayPublishOutcome,
} from "./community-leave-outbox";
import { loadSqliteGroupPersistedRows } from "./community-group-sqlite-store";
import { loadCommunityMembershipLedger } from "./community-membership-ledger";
import { loadGroupTombstones, addGroupTombstone } from "./group-tombstone-store";

vi.mock("./community-group-sqlite-store", () => ({
  loadSqliteGroupPersistedRows: vi.fn(async () => []),
}));

const PUBLIC_KEY = "a".repeat(64) as PublicKeyHex;
const PROFILE_ID = "default";
const GROUP_ID = "test-8";
const RELAY_URL = "wss://relay.test";

const sampleGroup = (): GroupConversation => ({
  kind: "group",
  id: `community:${GROUP_ID}:${RELAY_URL}`,
  communityId: `${GROUP_ID}:${RELAY_URL}`,
  groupId: GROUP_ID,
  relayUrl: RELAY_URL,
  displayName: "Test 8",
  memberPubkeys: [PUBLIC_KEY],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [PUBLIC_KEY],
});

describe("community-leave-recovery (P5-COM-2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(loadSqliteGroupPersistedRows).mockReset();
    vi.mocked(loadSqliteGroupPersistedRows).mockResolvedValue([]);
  });

  it("lists rejected leave outbox items only", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      profileId: PROFILE_ID,
    });
    recordCommunityLeaveRelayPublishOutcome({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      success: false,
      errorMessage: "relay declined",
      profileId: PROFILE_ID,
    });
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: "other",
      relayUrl: RELAY_URL,
      profileId: PROFILE_ID,
    });

    expect(listRejectedCommunityLeaveOutboxItems(PUBLIC_KEY, PROFILE_ID)).toHaveLength(1);
    expect(listRejectedCommunityLeaveOutboxItems(PUBLIC_KEY, PROFILE_ID)[0]?.groupId).toBe(GROUP_ID);
  });

  it("revokes terminal leave gates when relay publish was rejected", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      profileId: PROFILE_ID,
    });
    recordCommunityLeaveRelayPublishOutcome({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      success: false,
      profileId: PROFILE_ID,
    });
    addGroupTombstone(PUBLIC_KEY, { groupId: GROUP_ID, relayUrl: RELAY_URL }, { profileId: PROFILE_ID });

    expect(canRevokeCommunityLeaveTerminalState({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      profileId: PROFILE_ID,
    })).toBe(true);

    const revoked = revokeCommunityLeaveTerminalState({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      group: sampleGroup(),
      profileId: PROFILE_ID,
    });
    expect(revoked).toBe(true);
    expect(readCommunityLeaveOutbox(PUBLIC_KEY, PROFILE_ID)).toHaveLength(0);
    expect(loadGroupTombstones(PUBLIC_KEY, { profileId: PROFILE_ID }).size).toBe(0);
    const ledger = loadCommunityMembershipLedger(PUBLIC_KEY, { profileId: PROFILE_ID });
    expect(ledger.some((entry) => entry.groupId === GROUP_ID && entry.status === "joined")).toBe(true);
  });

  it("bulk restore revokes rejected intents when SQLite still has the group row", async () => {
    const group = sampleGroup();
    vi.mocked(loadSqliteGroupPersistedRows).mockResolvedValueOnce([
      toPersistedGroupConversation(group),
    ]);
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      profileId: PROFILE_ID,
    });
    recordCommunityLeaveRelayPublishOutcome({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      success: false,
      profileId: PROFILE_ID,
    });
    addGroupTombstone(PUBLIC_KEY, { groupId: GROUP_ID, relayUrl: RELAY_URL }, { profileId: PROFILE_ID });

    const result = await restoreRejectedCommunityLeaveIntents({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
    });

    expect(result.restored).toHaveLength(1);
    expect(result.restored[0]?.groupId).toBe(GROUP_ID);
    expect(result.skippedNoPersistedEvidence).toBe(0);
    expect(readCommunityLeaveOutbox(PUBLIC_KEY, PROFILE_ID)).toHaveLength(0);
    const ledger = loadCommunityMembershipLedger(PUBLIC_KEY, { profileId: PROFILE_ID });
    expect(ledger.some((entry) => entry.groupId === GROUP_ID && entry.status === "joined")).toBe(true);
  });

  it("bulk restore skips rejected intents without persisted SQLite evidence", async () => {
    vi.mocked(loadSqliteGroupPersistedRows).mockResolvedValueOnce([]);
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      profileId: PROFILE_ID,
    });
    recordCommunityLeaveRelayPublishOutcome({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      success: false,
      profileId: PROFILE_ID,
    });

    const result = await restoreRejectedCommunityLeaveIntents({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
    });

    expect(result.restored).toHaveLength(0);
    expect(result.skippedNoPersistedEvidence).toBe(1);
    expect(readCommunityLeaveOutbox(PUBLIC_KEY, PROFILE_ID)).toHaveLength(1);
  });

  it("does not revoke when outbox is still pending", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      profileId: PROFILE_ID,
    });
    expect(revokeCommunityLeaveTerminalState({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      group: sampleGroup(),
      profileId: PROFILE_ID,
    })).toBe(false);
  });
});
