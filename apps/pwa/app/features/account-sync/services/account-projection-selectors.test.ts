import { describe, expect, it } from "vitest";
import type { AccountProjectionSnapshot } from "../account-event-contracts";
import {
  selectProjectionConversationMessages,
  selectProjectionDmConversations,
  selectProjectionAcceptedPeers,
  selectProjectionRequestsInboxItems,
} from "./account-projection-selectors";

const PROJECTION: AccountProjectionSnapshot = {
  profileId: "default",
  accountPublicKeyHex: "a".repeat(64) as any,
  contactsByPeer: {
    ["b".repeat(64)]: {
      peerPublicKeyHex: "b".repeat(64) as any,
      status: "accepted",
      direction: "outgoing",
      lastEvidenceAtUnixMs: 2_000,
      lastEventId: "accepted-b",
      lastRequestEventId: "req-b",
    },
    ["c".repeat(64)]: {
      peerPublicKeyHex: "c".repeat(64) as any,
      status: "pending",
      direction: "incoming",
      lastEvidenceAtUnixMs: 3_000,
      lastEventId: "pending-c",
      lastRequestEventId: "req-c",
    },
    ["d".repeat(64)]: {
      peerPublicKeyHex: "d".repeat(64) as any,
      status: "none",
      direction: "unknown",
      lastEvidenceAtUnixMs: 1_000,
      lastEventId: "removed-d",
    },
  },
  conversationsById: {
    convo_b: {
      conversationId: "convo_b",
      peerPublicKeyHex: "b".repeat(64) as any,
      lastMessagePreview: "hi b",
      lastMessageAtUnixMs: 2_100,
      unreadCount: 0,
    },
    convo_c: {
      conversationId: "convo_c",
      peerPublicKeyHex: "c".repeat(64) as any,
      lastMessagePreview: "hi c",
      lastMessageAtUnixMs: 3_100,
      unreadCount: 1,
    },
  },
  messagesByConversationId: {},
  sync: {
    checkpointsByTimelineKey: {},
    bootstrapImportApplied: true,
  },
  lastSequence: 5,
  updatedAtUnixMs: 3_100,
};

describe("account-projection-selectors", () => {
  it("returns accepted peers only", () => {
    expect(selectProjectionAcceptedPeers(PROJECTION)).toEqual(["b".repeat(64)]);
  });

  it("builds requests inbox entries from projection contacts", () => {
    const items = selectProjectionRequestsInboxItems(PROJECTION);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      peerPublicKeyHex: "c".repeat(64),
      status: "pending",
      isOutgoing: false,
      lastMessagePreview: "hi c",
      eventId: "req-c",
    });
    expect(items[1]).toMatchObject({
      peerPublicKeyHex: "b".repeat(64),
      status: "accepted",
      isOutgoing: true,
      lastMessagePreview: "hi b",
      eventId: "req-b",
    });
  });

  it("builds accepted DM conversations from projection contacts + conversations", () => {
    const conversations = selectProjectionDmConversations({
      projection: PROJECTION,
      myPublicKeyHex: "a".repeat(64) as any,
    });
    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toMatchObject({
      kind: "dm",
      pubkey: "b".repeat(64),
      id: "convo_b",
      lastMessage: "hi b",
      unreadCount: 0,
    });
  });

  it("maps projection timeline entries to chat message models", () => {
    const withTimeline: AccountProjectionSnapshot = {
      ...PROJECTION,
      messagesByConversationId: {
        convo_b: [
          {
            messageId: "m1",
            conversationId: "convo_b",
            peerPublicKeyHex: "b".repeat(64) as any,
            direction: "incoming",
            eventCreatedAtUnixSeconds: 10,
            plaintextPreview: "hello",
            observedAtUnixMs: 10_000,
          },
          {
            messageId: "m2",
            conversationId: "convo_b",
            peerPublicKeyHex: "b".repeat(64) as any,
            direction: "outgoing",
            eventCreatedAtUnixSeconds: 11,
            plaintextPreview: "hi back",
            observedAtUnixMs: 11_000,
          },
        ],
      },
    };

    const messages = selectProjectionConversationMessages({
      projection: withTimeline,
      conversationId: "convo_b",
      myPublicKeyHex: "a".repeat(64) as any,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      id: "m1",
      isOutgoing: false,
      content: "hello",
      conversationId: "convo_b",
    });
    expect(messages[1]).toMatchObject({
      id: "m2",
      isOutgoing: true,
      content: "hi back",
      conversationId: "convo_b",
    });
  });

  it("merges same-peer timeline entries across legacy conversation ids", () => {
    const peer = "b".repeat(64);
    const my = "a".repeat(64);
    const withSplitTimeline: AccountProjectionSnapshot = {
      ...PROJECTION,
      conversationsById: {
        canonical: {
          conversationId: "canonical",
          peerPublicKeyHex: peer as any,
          lastMessagePreview: "latest",
          lastMessageAtUnixMs: 3_000,
          unreadCount: 1,
        },
      },
      messagesByConversationId: {
        canonical: [
          {
            messageId: "m-in",
            conversationId: "canonical",
            peerPublicKeyHex: peer as any,
            direction: "incoming",
            eventCreatedAtUnixSeconds: 20,
            plaintextPreview: "incoming",
            observedAtUnixMs: 20_000,
          },
        ],
        legacy_peer_key: [
          {
            messageId: "m-out",
            conversationId: "legacy_peer_key",
            peerPublicKeyHex: peer as any,
            direction: "outgoing",
            eventCreatedAtUnixSeconds: 10,
            plaintextPreview: "outgoing",
            observedAtUnixMs: 10_000,
          },
        ],
      },
    };

    const messages = selectProjectionConversationMessages({
      projection: withSplitTimeline,
      conversationId: "canonical",
      myPublicKeyHex: my as any,
    });

    expect(messages.map((message) => message.id)).toEqual(["m-out", "m-in"]);
    expect(messages[0]).toMatchObject({
      isOutgoing: true,
      senderPubkey: my,
      recipientPubkey: peer,
    });
    expect(messages[1]).toMatchObject({
      isOutgoing: false,
      senderPubkey: peer,
      recipientPubkey: my,
    });
  });

  it("falls back to peer-inferred merge when requested conversation id has no direct timeline", () => {
    const my = "a".repeat(64);
    const peer = "b".repeat(64);
    const inferredConversationId = [my, peer].sort().join(":");
    const projection: AccountProjectionSnapshot = {
      ...PROJECTION,
      conversationsById: {},
      messagesByConversationId: {
        legacy_dm_id: [
          {
            messageId: "m1",
            conversationId: "legacy_dm_id",
            peerPublicKeyHex: peer as any,
            direction: "incoming",
            eventCreatedAtUnixSeconds: 10,
            plaintextPreview: "from peer",
            observedAtUnixMs: 10_000,
          },
          {
            messageId: "m2",
            conversationId: "legacy_dm_id",
            peerPublicKeyHex: peer as any,
            direction: "outgoing",
            eventCreatedAtUnixSeconds: 11,
            plaintextPreview: "from me",
            observedAtUnixMs: 11_000,
          },
        ],
      },
    };

    const messages = selectProjectionConversationMessages({
      projection,
      conversationId: inferredConversationId,
      myPublicKeyHex: my as any,
    });

    expect(messages.map((message) => message.id)).toEqual(["m1", "m2"]);
    expect(messages.every((message) => message.recipientPubkey === peer || message.senderPubkey === peer)).toBe(true);
  });
});
