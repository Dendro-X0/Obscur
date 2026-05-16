/**
 * REL-002 — Restored historical evidence must not drive live UI
 * (sidebar groups, unread badges, group message maps).
 */

import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMembershipLedgerEntry } from "@/app/features/groups/services/community-membership-ledger";
import { resolveCommunityMembershipCoordinator } from "@/app/features/groups/services/community-membership-coordinator";
import { mergeChatState } from "./restore-merge-chat-state";
import {
  buildNonLiveCommunityLedgerKeySet,
  sanitizeRestoredChatStateLiveCommunitySignals,
} from "./restore-live-community-boundary";
import type { EncryptedAccountBackupPayload } from "../account-sync-contracts";

const PUBLIC_KEY = "d".repeat(64) as PublicKeyHex;
const GROUP_ID = "hist-group";
const RELAY_URL = "wss://relay.hist.example";
const COMMUNITY_ID = `${GROUP_ID}:${RELAY_URL}`;
const CONVERSATION_ID = `community:${COMMUNITY_ID}`;

const historicalLedgerEntry = (): CommunityMembershipLedgerEntry => ({
  groupId: GROUP_ID,
  relayUrl: RELAY_URL,
  communityId: COMMUNITY_ID,
  status: "historical",
  updatedAtUnixMs: 3_000,
  publicKeyHex: PUBLIC_KEY,
});

const historicalChatState = (): NonNullable<EncryptedAccountBackupPayload["chatState"]> => ({
  version: 2,
  createdConnections: [],
  createdGroups: [
    {
      id: CONVERSATION_ID,
      communityId: COMMUNITY_ID,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      displayName: "Historical Group",
      memberPubkeys: [PUBLIC_KEY],
      lastMessage: "archived",
      unreadCount: 0,
      lastMessageTimeMs: 2_000,
    },
  ],
  connectionRequests: [],
  pinnedChatIds: [CONVERSATION_ID],
  hiddenChatIds: [],
  unreadByConversationId: {
    [CONVERSATION_ID]: 4,
  },
  connectionOverridesByConnectionId: {},
  messagesByConversationId: {},
  groupMessages: {
    [CONVERSATION_ID]: [
      {
        id: "msg-1",
        pubkey: PUBLIC_KEY,
        content: "archived",
        created_at: 1_000,
      },
    ],
  },
});

describe("REL-002 — restore live community boundary", () => {
  it("buildNonLiveCommunityLedgerKeySet includes historical", () => {
    const keys = buildNonLiveCommunityLedgerKeySet([historicalLedgerEntry()]);
    expect(keys.has(`${GROUP_ID}@@${RELAY_URL}`)).toBe(true);
  });

  it("sanitizeRestoredChatStateLiveCommunitySignals strips unread and groupMessages for historical ledger", () => {
    const sanitized = sanitizeRestoredChatStateLiveCommunitySignals(
      historicalChatState(),
      [historicalLedgerEntry()],
    )!;
    expect(sanitized.unreadByConversationId[CONVERSATION_ID]).toBeUndefined();
    expect(sanitized.groupMessages?.[CONVERSATION_ID]).toBeUndefined();
    expect(sanitized.pinnedChatIds).not.toContain(CONVERSATION_ID);
  });

  it("mergeChatState filters historical groups and live signals when ledger is provided", () => {
    const merged = mergeChatState(
      historicalChatState(),
      {
        ...historicalChatState(),
        unreadByConversationId: { [CONVERSATION_ID]: 9 },
      },
      { ledgerEntries: [historicalLedgerEntry()] },
    )!;
    expect(merged.createdGroups).toHaveLength(0);
    expect(merged.unreadByConversationId[CONVERSATION_ID]).toBeUndefined();
    expect(merged.groupMessages?.[CONVERSATION_ID]).toBeUndefined();
  });

  it("coordinator hydrate does not surface historical-only ledger as joined groups", () => {
    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-rel002",
      persistedGroups: [],
      membershipLedger: [historicalLedgerEntry()],
      tombstones: new Set<string>(),
    });
    expect(result.groups).toHaveLength(0);
    expect(result.membershipProjections.some((projection) => projection.status === "joined")).toBe(false);
  });
});
