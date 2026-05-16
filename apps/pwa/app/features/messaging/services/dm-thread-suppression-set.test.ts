import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  buildDmThreadSuppressionIdSet,
  persistedMessagesContainSuppressedIdentities,
} from "./dm-thread-suppression-set";

describe("dm-thread-suppression-set", () => {
  it("merges durable tombstones with projection removedMessageIds", () => {
    const merged = buildDmThreadSuppressionIdSet({
      durableSuppressedIds: new Set(["local-a", "evt-b"]),
      projection: {
        profileId: "p1",
        accountPublicKeyHex: "aa".repeat(32) as PublicKeyHex,
        contactsByPeer: {},
        conversationsById: {},
        messagesByConversationId: {},
        removedMessageIds: { "evt-c": Date.now() },
        sync: { checkpointsByTimelineKey: {}, bootstrapImportApplied: false },
        lastSequence: 0,
        updatedAtUnixMs: 0,
      },
    });
    expect(merged).toEqual(new Set(["local-a", "evt-b", "evt-c"]));
  });

  it("detects suppressed identities on persisted rows by id or eventId", () => {
    expect(persistedMessagesContainSuppressedIdentities(
      [{ id: "row-1", eventId: "evt-1" }],
      new Set(["evt-1"]),
    )).toBe(true);
    expect(persistedMessagesContainSuppressedIdentities(
      [{ id: "row-1", eventId: "evt-1" }],
      new Set(["row-1"]),
    )).toBe(true);
    expect(persistedMessagesContainSuppressedIdentities(
      [{ id: "row-1", eventId: "evt-1" }],
      new Set(["other"]),
    )).toBe(false);
  });
});
