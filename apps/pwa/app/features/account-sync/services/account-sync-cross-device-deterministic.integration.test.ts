import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AccountEvent } from "../account-event-contracts";
import { replayAccountEvents } from "./account-event-reducer";
import {
  selectProjectionAcceptedPeers,
  selectProjectionConversationMessages,
  selectProjectionDmConversations,
  selectProjectionRequestsInboxItems,
} from "./account-projection-selectors";

const PROFILE_ID = "default";
const USER_A = "a".repeat(64) as PublicKeyHex;
const USER_B = "b".repeat(64) as PublicKeyHex;
const CONVERSATION_ID = [USER_A, USER_B].sort().join(":");

const baseMeta = {
  profileId: PROFILE_ID,
  accountPublicKeyHex: USER_A,
} as const;

const withSequence = (event: AccountEvent, sequence: number) => ({ event, sequence });

describe("account sync cross-device deterministic replay", () => {
  it("keeps accepted contact + DM history stable across deterministic new-device replays", () => {
    for (let iteration = 1; iteration <= 10; iteration += 1) {
      const acceptedEvent = withSequence({
        ...baseMeta,
        type: "CONTACT_ACCEPTED",
        eventId: `accepted-${iteration}`,
        idempotencyKey: `accepted-${iteration}`,
        source: "local_bootstrap",
        observedAtUnixMs: 2_000,
        peerPublicKeyHex: USER_B,
        direction: "unknown",
        requestEventId: `req-${iteration}`,
      }, 1);
      const stalePendingReplay = withSequence({
        ...baseMeta,
        type: "CONTACT_REQUEST_RECEIVED",
        eventId: `stale-pending-${iteration}`,
        idempotencyKey: `stale-pending-${iteration}`,
        source: "local_bootstrap",
        observedAtUnixMs: 1_000,
        peerPublicKeyHex: USER_B,
        direction: "incoming",
        requestEventId: `legacy-${iteration}`,
      }, 2);
      const incomingDm = withSequence({
        ...baseMeta,
        type: "DM_RECEIVED",
        eventId: `dm-in-${iteration}`,
        idempotencyKey: `dm-in-${iteration}`,
        source: "relay_sync",
        observedAtUnixMs: 3_000,
        peerPublicKeyHex: USER_B,
        conversationId: CONVERSATION_ID,
        messageId: `m-in-${iteration}`,
        eventCreatedAtUnixSeconds: 100 + iteration,
        plaintextPreview: `hello-${iteration}`,
      }, 3);
      const outgoingDm = withSequence({
        ...baseMeta,
        type: "DM_SENT_CONFIRMED",
        eventId: `dm-out-${iteration}`,
        idempotencyKey: `dm-out-${iteration}`,
        source: "relay_live",
        observedAtUnixMs: 4_000,
        peerPublicKeyHex: USER_B,
        conversationId: CONVERSATION_ID,
        messageId: `m-out-${iteration}`,
        eventCreatedAtUnixSeconds: 200 + iteration,
        plaintextPreview: `reply-${iteration}`,
      }, 4);

      const projection = replayAccountEvents([
        outgoingDm,
        stalePendingReplay,
        acceptedEvent,
        incomingDm,
      ]);

      expect(projection).not.toBeNull();
      expect(projection?.contactsByPeer[USER_B]?.status).toBe("accepted");
      expect(selectProjectionAcceptedPeers(projection)).toEqual([USER_B]);

      const inboxItems = selectProjectionRequestsInboxItems(projection);
      expect(inboxItems).toHaveLength(1);
      expect(inboxItems[0]).toMatchObject({
        peerPublicKeyHex: USER_B,
        status: "accepted",
      });

      const conversations = selectProjectionDmConversations({
        projection,
        myPublicKeyHex: USER_A,
      });
      expect(conversations).toHaveLength(1);
      expect(conversations[0]?.id).toBe(CONVERSATION_ID);

      const timeline = selectProjectionConversationMessages({
        projection,
        conversationId: CONVERSATION_ID,
        myPublicKeyHex: USER_A,
      });
      expect(timeline.map((entry) => entry.id)).toEqual([`m-in-${iteration}`, `m-out-${iteration}`]);
    }
  });

  it("allows pending state only after explicit remove evidence in replay", () => {
    const projection = replayAccountEvents([
      withSequence({
        ...baseMeta,
        type: "CONTACT_ACCEPTED",
        eventId: "accepted",
        idempotencyKey: "accepted",
        source: "local_bootstrap",
        observedAtUnixMs: 1_000,
        peerPublicKeyHex: USER_B,
        direction: "outgoing",
      }, 1),
      withSequence({
        ...baseMeta,
        type: "CONTACT_REMOVED",
        eventId: "removed",
        idempotencyKey: "removed",
        source: "legacy_bridge",
        observedAtUnixMs: 2_000,
        peerPublicKeyHex: USER_B,
        direction: "unknown",
      }, 2),
      withSequence({
        ...baseMeta,
        type: "CONTACT_REQUEST_RECEIVED",
        eventId: "new-request",
        idempotencyKey: "new-request",
        source: "relay_sync",
        observedAtUnixMs: 3_000,
        peerPublicKeyHex: USER_B,
        direction: "incoming",
        requestEventId: "new-request",
      }, 3),
    ]);

    expect(projection?.contactsByPeer[USER_B]?.status).toBe("pending");
    const inboxItems = selectProjectionRequestsInboxItems(projection);
    expect(inboxItems[0]?.status).toBe("pending");
  });
});
