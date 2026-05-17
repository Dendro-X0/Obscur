import { describe, expect, it } from "vitest";
import type { AccountEvent } from "../account-event-contracts";
import { replayAccountEvents } from "./account-event-reducer";

const PROFILE_ID = "default";
const ACCOUNT = "a".repeat(64) as any;
const PEER = "b".repeat(64) as any;

const createEvent = (event: AccountEvent, sequence: number) => ({ event, sequence });

const baseMeta = {
  profileId: PROFILE_ID,
  accountPublicKeyHex: ACCOUNT,
  source: "legacy_bridge" as const,
};

describe("account-event-reducer", () => {
  it("replays deterministic projection state regardless of input order", () => {
    const events = [
      createEvent({
        ...baseMeta,
        type: "CONTACT_REQUEST_SENT",
        eventId: "request-sent-1",
        idempotencyKey: "request-sent-1",
        observedAtUnixMs: 1_000,
        peerPublicKeyHex: PEER,
        direction: "outgoing",
        requestEventId: "req-1",
      }, 1),
      createEvent({
        ...baseMeta,
        type: "CONTACT_ACCEPTED",
        eventId: "accepted-1",
        idempotencyKey: "accepted-1",
        observedAtUnixMs: 2_000,
        peerPublicKeyHex: PEER,
        direction: "outgoing",
        requestEventId: "req-1",
      }, 2),
      createEvent({
        ...baseMeta,
        type: "DM_SENT_CONFIRMED",
        eventId: "dm-out-1",
        idempotencyKey: "dm-out-1",
        observedAtUnixMs: 3_000,
        peerPublicKeyHex: PEER,
        conversationId: `${ACCOUNT}:${PEER}`,
        messageId: "m1",
        eventCreatedAtUnixSeconds: 3,
        plaintextPreview: "hello",
      }, 3),
      createEvent({
        ...baseMeta,
        type: "DM_RECEIVED",
        eventId: "dm-in-1",
        idempotencyKey: "dm-in-1",
        observedAtUnixMs: 4_000,
        peerPublicKeyHex: PEER,
        conversationId: `${ACCOUNT}:${PEER}`,
        messageId: "m2",
        eventCreatedAtUnixSeconds: 4,
        plaintextPreview: "world",
      }, 4),
    ] as const;

    const shuffled = [events[3], events[1], events[0], events[2]];
    const projection = replayAccountEvents(shuffled);

    expect(projection).not.toBeNull();
    expect(projection?.contactsByPeer[PEER].status).toBe("accepted");
    expect(projection?.conversationsById[`${ACCOUNT}:${PEER}`].lastMessagePreview).toBe("world");
    expect(projection?.messagesByConversationId[`${ACCOUNT}:${PEER}`]).toHaveLength(2);
    expect(projection?.lastSequence).toBe(4);
  });

  it("keeps checkpoint monotonic and dedupes DM by messageId", () => {
    const projection = replayAccountEvents([
      createEvent({
        ...baseMeta,
        type: "SYNC_CHECKPOINT_ADVANCED",
        eventId: "ckpt-1",
        idempotencyKey: "ckpt-1",
        observedAtUnixMs: 1_000,
        timelineKey: "dm:all",
        lastProcessedAtUnixSeconds: 100,
      }, 1),
      createEvent({
        ...baseMeta,
        type: "DM_RECEIVED",
        eventId: "dm-dup-1",
        idempotencyKey: "dm-dup-1",
        observedAtUnixMs: 1_500,
        peerPublicKeyHex: PEER,
        conversationId: `${ACCOUNT}:${PEER}`,
        messageId: "same-message",
        eventCreatedAtUnixSeconds: 10,
        plaintextPreview: "first",
      }, 2),
      createEvent({
        ...baseMeta,
        type: "DM_RECEIVED",
        eventId: "dm-dup-2",
        idempotencyKey: "dm-dup-2",
        observedAtUnixMs: 2_000,
        peerPublicKeyHex: PEER,
        conversationId: `${ACCOUNT}:${PEER}`,
        messageId: "same-message",
        eventCreatedAtUnixSeconds: 10,
        plaintextPreview: "second",
      }, 3),
      createEvent({
        ...baseMeta,
        type: "SYNC_CHECKPOINT_ADVANCED",
        eventId: "ckpt-2",
        idempotencyKey: "ckpt-2",
        observedAtUnixMs: 2_500,
        timelineKey: "dm:all",
        lastProcessedAtUnixSeconds: 90,
      }, 4),
    ]);

    expect(projection).not.toBeNull();
    expect(projection?.messagesByConversationId[`${ACCOUNT}:${PEER}`]).toHaveLength(1);
    expect(projection?.messagesByConversationId[`${ACCOUNT}:${PEER}`][0]?.plaintextPreview).toBe("second");
    expect(projection?.sync.checkpointsByTimelineKey["dm:all"]).toBe(100);
    expect(projection?.conversationsById[`${ACCOUNT}:${PEER}`]?.unreadCount).toBe(0);
  });

  it("does not inflate unread for relay_sync/bootstrap replay history but counts live incoming once", () => {
    const conversationId = `${ACCOUNT}:${PEER}`;
    const projection = replayAccountEvents([
      createEvent({
        ...baseMeta,
        source: "local_bootstrap",
        type: "DM_RECEIVED",
        eventId: "bootstrap-in-1",
        idempotencyKey: "bootstrap-in-1",
        observedAtUnixMs: 1_000,
        peerPublicKeyHex: PEER,
        conversationId,
        messageId: "bootstrap-msg-1",
        eventCreatedAtUnixSeconds: 10,
        plaintextPreview: "bootstrap",
      }, 1),
      createEvent({
        ...baseMeta,
        source: "relay_sync",
        type: "DM_RECEIVED",
        eventId: "sync-in-1",
        idempotencyKey: "sync-in-1",
        observedAtUnixMs: 2_000,
        peerPublicKeyHex: PEER,
        conversationId,
        messageId: "sync-msg-1",
        eventCreatedAtUnixSeconds: 20,
        plaintextPreview: "sync",
      }, 2),
      createEvent({
        ...baseMeta,
        source: "relay_live",
        type: "DM_RECEIVED",
        eventId: "live-in-1",
        idempotencyKey: "live-in-1",
        observedAtUnixMs: 3_000,
        peerPublicKeyHex: PEER,
        conversationId,
        messageId: "live-msg-1",
        eventCreatedAtUnixSeconds: 30,
        plaintextPreview: "live",
      }, 3),
      createEvent({
        ...baseMeta,
        source: "relay_live",
        type: "DM_RECEIVED",
        eventId: "live-in-duplicate",
        idempotencyKey: "live-in-duplicate",
        observedAtUnixMs: 3_500,
        peerPublicKeyHex: PEER,
        conversationId,
        messageId: "live-msg-1",
        eventCreatedAtUnixSeconds: 30,
        plaintextPreview: "live-updated",
      }, 4),
    ]);

    expect(projection).not.toBeNull();
    expect(projection?.messagesByConversationId[conversationId]).toHaveLength(3);
    expect(projection?.conversationsById[conversationId]?.unreadCount).toBe(1);
    expect(projection?.conversationsById[conversationId]?.lastMessagePreview).toBe("live-updated");
  });

  it("removes messages from projection when local delete events replay later", () => {
    const conversationId = `${ACCOUNT}:${PEER}`;
    const projection = replayAccountEvents([
      createEvent({
        ...baseMeta,
        type: "DM_RECEIVED",
        eventId: "dm-in-del-1",
        idempotencyKey: "dm-in-del-1",
        observedAtUnixMs: 1_000,
        peerPublicKeyHex: PEER,
        conversationId,
        messageId: "msg-delete-me",
        eventCreatedAtUnixSeconds: 10,
        plaintextPreview: "incoming",
      }, 1),
      createEvent({
        ...baseMeta,
        type: "DM_SENT_CONFIRMED",
        eventId: "dm-out-keep-1",
        idempotencyKey: "dm-out-keep-1",
        observedAtUnixMs: 2_000,
        peerPublicKeyHex: PEER,
        conversationId,
        messageId: "msg-keep",
        eventCreatedAtUnixSeconds: 20,
        plaintextPreview: "keep",
      }, 2),
      createEvent({
        ...baseMeta,
        type: "DM_REMOVED_LOCALLY",
        eventId: "dm-remove-1",
        idempotencyKey: "dm-remove-1",
        observedAtUnixMs: 3_000,
        messageId: "msg-delete-me",
        conversationId,
      }, 3),
    ]);

    expect(projection?.messagesByConversationId[conversationId]).toEqual([
      expect.objectContaining({ messageId: "msg-keep" }),
    ]);
    expect(projection?.conversationsById[conversationId]?.lastMessagePreview).toBe("keep");
    expect(projection?.conversationsById[conversationId]?.unreadCount).toBe(0);
  });

  it("keeps tombstoned projection messages removed even if stale receive events replay later", () => {
    const conversationId = `${ACCOUNT}:${PEER}`;
    const projection = replayAccountEvents([
      createEvent({
        ...baseMeta,
        type: "DM_RECEIVED",
        eventId: "dm-in-initial",
        idempotencyKey: "dm-in-initial",
        observedAtUnixMs: 1_000,
        peerPublicKeyHex: PEER,
        conversationId,
        messageId: "msg-tombstoned",
        eventCreatedAtUnixSeconds: 10,
        plaintextPreview: "first copy",
      }, 1),
      createEvent({
        ...baseMeta,
        type: "DM_REMOVED_LOCALLY",
        eventId: "dm-remove-sticky",
        idempotencyKey: "dm-remove-sticky",
        observedAtUnixMs: 2_000,
        messageId: "msg-tombstoned",
        conversationId,
      }, 2),
      createEvent({
        ...baseMeta,
        type: "DM_RECEIVED",
        eventId: "dm-in-stale-replay",
        idempotencyKey: "dm-in-stale-replay",
        observedAtUnixMs: 3_000,
        peerPublicKeyHex: PEER,
        conversationId,
        messageId: "msg-tombstoned",
        eventCreatedAtUnixSeconds: 10,
        plaintextPreview: "stale replay",
      }, 3),
    ]);

    expect(projection?.messagesByConversationId[conversationId]).toEqual([]);
    expect(projection?.removedMessageIds?.["msg-tombstoned"]).toBe(2_000);
  });

  it("does not regress accepted contact back to pending from stale request replay", () => {
    const projection = replayAccountEvents([
      createEvent({
        ...baseMeta,
        type: "CONTACT_ACCEPTED",
        eventId: "accepted-1",
        idempotencyKey: "accepted-1",
        observedAtUnixMs: 2_000,
        peerPublicKeyHex: PEER,
        direction: "unknown",
        requestEventId: "req-1",
      }, 1),
      createEvent({
        ...baseMeta,
        type: "CONTACT_REQUEST_RECEIVED",
        eventId: "request-stale",
        idempotencyKey: "request-stale",
        observedAtUnixMs: 1_000,
        peerPublicKeyHex: PEER,
        direction: "incoming",
        requestEventId: "req-legacy",
      }, 2),
    ]);

    expect(projection).not.toBeNull();
    expect(projection?.contactsByPeer[PEER]?.status).toBe("accepted");
    expect(projection?.contactsByPeer[PEER]?.lastEventId).toBe("accepted-1");
  });

  it("allows accepted contact to become pending again after explicit removal", () => {
    const projection = replayAccountEvents([
      createEvent({
        ...baseMeta,
        type: "CONTACT_ACCEPTED",
        eventId: "accepted-2",
        idempotencyKey: "accepted-2",
        observedAtUnixMs: 1_000,
        peerPublicKeyHex: PEER,
        direction: "outgoing",
        requestEventId: "req-2",
      }, 1),
      createEvent({
        ...baseMeta,
        type: "CONTACT_REMOVED",
        eventId: "removed-2",
        idempotencyKey: "removed-2",
        observedAtUnixMs: 2_000,
        peerPublicKeyHex: PEER,
        direction: "unknown",
      }, 2),
      createEvent({
        ...baseMeta,
        type: "CONTACT_REQUEST_RECEIVED",
        eventId: "request-new-2",
        idempotencyKey: "request-new-2",
        observedAtUnixMs: 3_000,
        peerPublicKeyHex: PEER,
        direction: "incoming",
        requestEventId: "req-3",
      }, 3),
    ]);

    expect(projection).not.toBeNull();
    expect(projection?.contactsByPeer[PEER]?.status).toBe("pending");
    expect(projection?.contactsByPeer[PEER]?.lastEventId).toBe("request-new-2");
  });
});
