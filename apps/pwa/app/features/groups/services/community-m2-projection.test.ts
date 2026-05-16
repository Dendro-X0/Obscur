/**
 * M2 Projection And Restore Boundary Tests
 *
 * AB-11: Room key without membership — decryption/history may be available;
 *        sendability must be blocked_left (or blocked_room_key_missing per spec).
 *
 * AB-12: Membership without room key — row may be visible;
 *        sendability must be blocked_room_key_missing.
 *
 * M2-dedup: explicit user-intent statuses always beat 'historical' reconstruction
 *           in the ledger dedup merge, regardless of timestamp.
 *
 * M2-suppression: 'historical' ledger entries do not appear in the active
 *                 community list — the projection layer suppresses them.
 */

import { describe, expect, it } from "vitest";
import {
  mergeCommunityMembershipLedgerEntries,
  type CommunityMembershipLedgerEntry,
} from "./community-membership-ledger";
import { checkCommunitySendability } from "./community-sendability-guard";
import {
  reconstructCommunityMembershipFromChatState,
} from "./community-membership-reconstruction";
import type { PersistedChatState } from "@/app/features/messaging/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeExplicitEntry = (
  status: CommunityMembershipLedgerEntry["status"],
  updatedAtUnixMs: number,
): CommunityMembershipLedgerEntry => ({
  communityId: "alpha:wss://relay.alpha",
  groupId: "alpha",
  relayUrl: "wss://relay.alpha",
  status,
  updatedAtUnixMs,
});

const makeHistoricalEntry = (updatedAtUnixMs: number): CommunityMembershipLedgerEntry => ({
  communityId: "alpha:wss://relay.alpha",
  groupId: "alpha",
  relayUrl: "wss://relay.alpha",
  status: "historical",
  updatedAtUnixMs,
});

const emptyState = (): PersistedChatState => ({
  version: 2,
  createdConnections: [],
  createdGroups: [],
  unreadByConversationId: {},
  connectionOverridesByConnectionId: {},
  messagesByConversationId: {},
  groupMessages: {},
  connectionRequests: [],
  pinnedChatIds: [],
  hiddenChatIds: [],
});

// ---------------------------------------------------------------------------
// M2-dedup: status precedence in dedup merge
// ---------------------------------------------------------------------------

describe("M2 — historical status never beats explicit user-intent status in dedup", () => {
  it("joined (older ts) beats historical (newer ts)", () => {
    const joined = makeExplicitEntry("joined", 1_000);
    const historical = makeHistoricalEntry(9_000);

    const merged = mergeCommunityMembershipLedgerEntries([joined], [historical]);

    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("joined");
    expect(merged[0].updatedAtUnixMs).toBe(1_000);
  });

  it("left (older ts) beats historical (newer ts)", () => {
    const left = makeExplicitEntry("left", 500);
    const historical = makeHistoricalEntry(9_999);

    const merged = mergeCommunityMembershipLedgerEntries([left], [historical]);

    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("left");
  });

  it("expelled (older ts) beats historical (newer ts)", () => {
    const expelled = makeExplicitEntry("expelled", 100);
    const historical = makeHistoricalEntry(99_999);

    const merged = mergeCommunityMembershipLedgerEntries([expelled], [historical]);

    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("expelled");
  });

  it("historical with same ts does not override joined", () => {
    const ts = 5_000;
    const joined = makeExplicitEntry("joined", ts);
    const historical = makeHistoricalEntry(ts);

    const merged = mergeCommunityMembershipLedgerEntries([joined], [historical]);

    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("joined");
  });

  it("two historical entries dedup to one by timestamp", () => {
    const old = makeHistoricalEntry(1_000);
    const fresh = makeHistoricalEntry(5_000);

    const merged = mergeCommunityMembershipLedgerEntries([old], [fresh]);

    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("historical");
    expect(merged[0].updatedAtUnixMs).toBe(5_000);
  });
});

// ---------------------------------------------------------------------------
// M2-suppression: reconstructed entries arrive as 'historical'
// ---------------------------------------------------------------------------

describe("M2 — reconstructed entries from chat state arrive as historical", () => {
  it("group messages produce historical not joined entries", () => {
    const chatState: PersistedChatState = {
      ...emptyState(),
      groupMessages: {
        "community:alpha:wss://relay.alpha": [{
          id: "g1",
          pubkey: "peer",
          created_at: 100,
          content: "hello",
        }],
      },
    };

    const entries = reconstructCommunityMembershipFromChatState(chatState);
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe("historical");
  });

  it("createdGroups produce historical not joined entries", () => {
    const chatState: PersistedChatState = {
      ...emptyState(),
      createdGroups: [{
        id: "community:alpha:wss://relay.alpha",
        communityId: "alpha:wss://relay.alpha",
        groupId: "alpha",
        relayUrl: "wss://relay.alpha",
        displayName: "Alpha",
        memberPubkeys: [],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTimeMs: 2_000,
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      }],
    };

    const entries = reconstructCommunityMembershipFromChatState(chatState);
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe("historical");
  });

  it("historical reconstruction does not resurrect a group after explicit left", () => {
    const chatState: PersistedChatState = {
      ...emptyState(),
      groupMessages: {
        "community:alpha:wss://relay.alpha": [{
          id: "g1",
          pubkey: "peer",
          created_at: 9999,
          content: "old message",
        }],
      },
    };

    const reconstructed = reconstructCommunityMembershipFromChatState(chatState);
    const localLeft = makeExplicitEntry("left", 1_000);

    // Merge reconstructed into the explicit local ledger
    const merged = mergeCommunityMembershipLedgerEntries([localLeft], reconstructed);

    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("left");
  });
});

// ---------------------------------------------------------------------------
// AB-11: room key present, membership is historical → sendability blocked
// ---------------------------------------------------------------------------

describe("AB-11 — room key without confirmed membership blocks sendability", () => {
  it("historical ledger status blocks sending even when room key is present", () => {
    const result = checkCommunitySendability({
      groupId: "alpha",
      localMemberPubkey: "pubkey1" as import("@dweb/crypto/public-key-hex").PublicKeyHex,
      membershipStatus: "member",
      ledgerStatus: "historical",
      hasRoomKey: true,
      roomKeyEpochMs: Date.now(),
    });

    expect(result.canSend).toBe(false);
    expect(result.reasonCode).toBe("historical_only");
  });

  it("left ledger status blocks sending even when room key is present (decryption allowed, send blocked)", () => {
    const result = checkCommunitySendability({
      groupId: "alpha",
      localMemberPubkey: "pubkey1" as import("@dweb/crypto/public-key-hex").PublicKeyHex,
      membershipStatus: "member",
      ledgerStatus: "left",
      hasRoomKey: true,
      roomKeyEpochMs: Date.now(),
      leftPubkeys: new Set(["pubkey1"]),
    });

    expect(result.canSend).toBe(false);
    expect(result.reasonCode).toBe("left");
  });
});

// ---------------------------------------------------------------------------
// AB-12: membership present, room key missing → sendability blocked
// ---------------------------------------------------------------------------

describe("AB-12 — confirmed membership without room key blocks sendability", () => {
  it("joined ledger status with no room key blocks sending", () => {
    const result = checkCommunitySendability({
      groupId: "alpha",
      localMemberPubkey: "pubkey1" as import("@dweb/crypto/public-key-hex").PublicKeyHex,
      membershipStatus: "member",
      ledgerStatus: "joined",
      hasRoomKey: false,
    });

    expect(result.canSend).toBe(false);
    expect(result.reasonCode).toBe("no_room_key");
  });

  it("joined ledger status with room key allows sending", () => {
    const result = checkCommunitySendability({
      groupId: "alpha",
      localMemberPubkey: "pubkey1" as import("@dweb/crypto/public-key-hex").PublicKeyHex,
      membershipStatus: "member",
      ledgerStatus: "joined",
      hasRoomKey: true,
      roomKeyEpochMs: Date.now(),
    });

    expect(result.canSend).toBe(true);
    expect(result.reasonCode).toBe("ready");
  });
});
