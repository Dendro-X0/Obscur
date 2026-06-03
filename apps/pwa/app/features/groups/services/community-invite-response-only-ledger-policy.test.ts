import { describe, expect, it } from "vitest";
import type { PersistedChatState } from "@/app/features/messaging/types";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import {
  downgradeInviteResponseOnlyJoinedLedgerEntries,
  hasDurableJoinedCommunityMembershipEvidence,
} from "./community-invite-response-only-ledger-policy";

const GROUP_ID = "beta";
const RELAY_URL = "wss://relay.beta";
const COMMUNITY_ID = `${GROUP_ID}:${RELAY_URL}`;

const emptyChatState = (): PersistedChatState => ({
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

const joinedEntry = (): CommunityMembershipLedgerEntry => ({
  groupId: GROUP_ID,
  relayUrl: RELAY_URL,
  communityId: COMMUNITY_ID,
  status: "joined",
  updatedAtUnixMs: 2_000,
});

describe("MEM-004 — invite-response-only joined ledger policy", () => {
  it("joined without durable evidence is not considered durable", () => {
    const chatState: PersistedChatState = {
      ...emptyChatState(),
      messagesByConversationId: {
        "dm:peer": [{
          id: "m-response-only",
          content: JSON.stringify({
            type: "community-invite-response",
            status: "accepted",
            groupId: GROUP_ID,
            relayUrl: RELAY_URL,
            communityId: COMMUNITY_ID,
          }),
          timestampMs: 2_000,
          isOutgoing: false,
          status: "delivered",
        }],
      },
    };

    expect(hasDurableJoinedCommunityMembershipEvidence({
      entry: joinedEntry(),
      chatState,
      roomKeys: [],
    })).toBe(false);
  });

  it("downgrades invite-response-only joined rows to historical", () => {
    const chatState: PersistedChatState = {
      ...emptyChatState(),
      messagesByConversationId: {
        "dm:peer": [{
          id: "m-response-only",
          content: JSON.stringify({
            type: "community-invite-response",
            status: "accepted",
            groupId: GROUP_ID,
            relayUrl: RELAY_URL,
          }),
          timestampMs: 2_000,
          isOutgoing: false,
          status: "delivered",
        }],
      },
    };

    const downgraded = downgradeInviteResponseOnlyJoinedLedgerEntries({
      entries: [joinedEntry()],
      chatState,
      roomKeys: [],
    });

    expect(downgraded[0]?.status).toBe("historical");
  });

  it("preserves joined when room key evidence exists", () => {
    expect(hasDurableJoinedCommunityMembershipEvidence({
      entry: joinedEntry(),
      chatState: emptyChatState(),
      roomKeys: [{ groupId: GROUP_ID, roomKeyHex: "rk-1", createdAt: 1_000 }],
    })).toBe(true);
  });

  it("preserves joined when DM includes community-invite with room key", () => {
    const chatState: PersistedChatState = {
      ...emptyChatState(),
      messagesByConversationId: {
        "dm:peer": [{
          id: "m-invite",
          content: JSON.stringify({
            type: "community-invite",
            groupId: GROUP_ID,
            relayUrl: RELAY_URL,
            roomKey: "rk-1",
          }),
          timestampMs: 1_000,
          isOutgoing: false,
          status: "delivered",
        }],
      },
    };

    const downgraded = downgradeInviteResponseOnlyJoinedLedgerEntries({
      entries: [joinedEntry()],
      chatState,
      roomKeys: [],
    });

    expect(downgraded[0]?.status).toBe("joined");
  });
});
