/**
 * R1 / DM-001 — delete-for-me survives reload when thread assembly uses materialization port.
 */
import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { MessageProjection } from "@/app/features/account-sync/account-event-contracts";
import type { Message } from "../types";
import { replayAccountEvents } from "@/app/features/account-sync/services/account-event-reducer";
import type { AccountEvent } from "@/app/features/account-sync/account-event-contracts";
import { dmConversationMaterializationOwner } from "./thread-history/dm-adapter";
import { messagingClientOperations } from "./messaging-client-operations";

const PROFILE_ID = "profile-r1-reload";
const ACCOUNT = "ee".repeat(32) as PublicKeyHex;
const PEER = "ff".repeat(32) as PublicKeyHex;
const CONVERSATION_ID = `${ACCOUNT}:${PEER}`;

const createDmReceived = (messageId: string): AccountEvent => ({
  type: "DM_RECEIVED",
  profileId: PROFILE_ID,
  accountPublicKeyHex: ACCOUNT,
  eventId: `dm-${messageId}`,
  idempotencyKey: `dm-${messageId}`,
  observedAtUnixMs: 1_000,
  source: "legacy_bridge",
  peerPublicKeyHex: PEER,
  conversationId: CONVERSATION_ID,
  messageId,
  eventCreatedAtUnixSeconds: 10,
  plaintextPreview: "hello",
});

const projectionMessageFromTimeline = (entry: MessageProjection): Message => ({
  id: entry.messageId,
  kind: "user",
  content: entry.plaintextPreview,
  timestamp: new Date(entry.eventCreatedAtUnixSeconds * 1000),
  isOutgoing: entry.direction === "outgoing",
  status: "delivered",
  conversationId: entry.conversationId,
});

describe("dm materialization reload suppression (R1)", () => {
  it("port filters deleted message ids after projection replay", () => {
    const events = [
      { sequence: 1, event: createDmReceived("msg-a") },
      { sequence: 2, event: createDmReceived("msg-b") },
      {
        sequence: 3,
        event: {
          type: "DM_REMOVED_LOCALLY",
          profileId: PROFILE_ID,
          accountPublicKeyHex: ACCOUNT,
          eventId: "removed-msg-a",
          idempotencyKey: "removed-msg-a",
          observedAtUnixMs: 2_000,
          source: "legacy_bridge",
          messageId: "msg-a",
          conversationId: CONVERSATION_ID,
        } satisfies AccountEvent,
      },
    ];

    const projection = replayAccountEvents(events);
    const timeline = projection?.messagesByConversationId[CONVERSATION_ID] ?? [];
    const displayRows = timeline.map(projectionMessageFromTimeline);

    const suppressedIds = new Set(["msg-a"]);
    const viaOwner = dmConversationMaterializationOwner.filterThreadMessagesBySuppression(
      displayRows,
      suppressedIds,
    );
    const viaFacade = messagingClientOperations.filterDmThreadMessagesBySuppression(
      displayRows,
      suppressedIds,
    );

    expect(viaOwner.map((row) => row.id)).toEqual(["msg-b"]);
    expect(viaFacade.map((row) => row.id)).toEqual(["msg-b"]);
  });
});
