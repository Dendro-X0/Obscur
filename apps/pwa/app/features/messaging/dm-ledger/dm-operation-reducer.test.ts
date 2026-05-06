/**
 * dm-operation-reducer.test.ts
 *
 * Comprehensive tests for the DM operation reducer.
 * These tests verify that message visibility is derived correctly
 * from sequences of operations.
 */

import { describe, it, expect } from "vitest";
import { reduceDmOperations, isMessageDeletedInProjection } from "./dm-operation-reducer";
import type {
  DmMessageUpsertOperation,
  DmMessageDeleteOperation,
  DmOperation,
} from "./dm-operation-types";
import type { Message } from "../types";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

const createMessage = (id: string, eventId?: string): Message => ({
  id,
  eventId,
  kind: "user",
  content: `message ${id}`,
  timestamp: new Date(1_700_000_000_000),
  isOutgoing: false,
  status: "delivered",
  senderPubkey: "aaa".padEnd(64, "0"),
});

const createUpsert = (params: {
  opId: string;
  messageId: string;
  identityIds: string[];
  eventId?: string;
  observedAtMs?: number;
}): DmMessageUpsertOperation => ({
  op: "message_upsert",
  opId: params.opId,
  conversationId: "conv:test",
  messageId: params.messageId,
  identityIds: params.identityIds,
  message: createMessage(params.messageId, params.eventId),
  senderPubkey: "aaa".padEnd(64, "0") as any,
  isOutgoing: false,
  observedAtMs: params.observedAtMs ?? Date.now(),
  source: "relay_live",
});

const createDelete = (params: {
  opId: string;
  targetIdentityIds: string[];
  observedAtMs?: number;
}): DmMessageDeleteOperation => ({
  op: "message_delete",
  opId: params.opId,
  conversationId: "conv:test",
  targetIdentityIds: params.targetIdentityIds,
  deletedByPubkey: "bbb".padEnd(64, "0") as any,
  isLocalDelete: false,
  observedAtMs: params.observedAtMs ?? Date.now(),
  source: "relay_live",
});

// ---------------------------------------------------------------------------
// Basic Upsert Tests
// ---------------------------------------------------------------------------

describe("dm-operation-reducer > upsert", () => {
  it("shows a single upserted message", () => {
    const ops: DmOperation[] = [
      createUpsert({ opId: "op1", messageId: "msg1", identityIds: ["msg1", "event1"] }),
    ];

    const result = reduceDmOperations(ops);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.id).toBe("msg1");
    expect(result.tombstones.size).toBe(0);
  });

  it("shows multiple upserted messages", () => {
    const ops: DmOperation[] = [
      createUpsert({ opId: "op1", messageId: "msg1", identityIds: ["msg1"], observedAtMs: 1000 }),
      createUpsert({ opId: "op2", messageId: "msg2", identityIds: ["msg2"], observedAtMs: 2000 }),
    ];

    const result = reduceDmOperations(ops);

    expect(result.messages).toHaveLength(2);
    expect(result.messages.map(m => m.id)).toContain("msg1");
    expect(result.messages.map(m => m.id)).toContain("msg2");
  });

  it("deduplicates by opId (idempotent)", () => {
    const upsert = createUpsert({ opId: "op1", messageId: "msg1", identityIds: ["msg1"] });

    const ops: DmOperation[] = [upsert, upsert, upsert];

    const result = reduceDmOperations(ops);

    expect(result.messages).toHaveLength(1);
    expect(result.operationCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Delete Tests
// ---------------------------------------------------------------------------

describe("dm-operation-reducer > delete", () => {
  it("removes message by primary ID", () => {
    const ops: DmOperation[] = [
      createUpsert({ opId: "op1", messageId: "msg1", identityIds: ["msg1"], observedAtMs: 1000 }),
      createDelete({ opId: "op2", targetIdentityIds: ["msg1"], observedAtMs: 2000 }),
    ];

    const result = reduceDmOperations(ops);

    expect(result.messages).toHaveLength(0);
    expect(result.tombstones.has("msg1")).toBe(true);
  });

  it("removes message by eventId alias", () => {
    const ops: DmOperation[] = [
      createUpsert({
        opId: "op1",
        messageId: "msg1",
        identityIds: ["msg1", "event123"],
        eventId: "event123",
        observedAtMs: 1000,
      }),
      createDelete({ opId: "op2", targetIdentityIds: ["event123"], observedAtMs: 2000 }),
    ];

    const result = reduceDmOperations(ops);

    expect(result.messages).toHaveLength(0);
    expect(result.tombstones.has("event123")).toBe(true);
  });

  it("removes message by any alias in the list", () => {
    const ops: DmOperation[] = [
      createUpsert({
        opId: "op1",
        messageId: "optimistic-uuid",
        identityIds: ["optimistic-uuid", "relay-event-id", "rumor-id"],
        observedAtMs: 1000,
      }),
      createDelete({ opId: "op2", targetIdentityIds: ["rumor-id"], observedAtMs: 2000 }),
    ];

    const result = reduceDmOperations(ops);

    expect(result.messages).toHaveLength(0);
    expect(result.tombstones.has("rumor-id")).toBe(true);
  });

  it("tombstones all provided identity IDs", () => {
    const ops: DmOperation[] = [
      createDelete({ opId: "op1", targetIdentityIds: ["id1", "id2", "id3"] }),
    ];

    const result = reduceDmOperations(ops);

    expect(result.tombstones.has("id1")).toBe(true);
    expect(result.tombstones.has("id2")).toBe(true);
    expect(result.tombstones.has("id3")).toBe(true);
  });

  it("is idempotent - duplicate delete operations don't change state", () => {
    const ops: DmOperation[] = [
      createUpsert({ opId: "op1", messageId: "msg1", identityIds: ["msg1"], observedAtMs: 1000 }),
      createDelete({ opId: "op2", targetIdentityIds: ["msg1"], observedAtMs: 2000 }),
      createDelete({ opId: "op2", targetIdentityIds: ["msg1"], observedAtMs: 2000 }), // duplicate
    ];

    const result = reduceDmOperations(ops);

    expect(result.messages).toHaveLength(0);
    expect(result.operationCount).toBe(2); // second delete is skipped
  });
});

// ---------------------------------------------------------------------------
// Anti-Resurrection Tests (The Critical Cases)
// ---------------------------------------------------------------------------

describe("dm-operation-reducer > anti-resurrection", () => {
  it("delete then upsert with same ID = message invisible (delete wins)", () => {
    // This simulates: delete locally, then sync brings back the message
    const ops: DmOperation[] = [
      createDelete({ opId: "op1", targetIdentityIds: ["msg1"], observedAtMs: 1000 }),
      createUpsert({ opId: "op2", messageId: "msg1", identityIds: ["msg1"], observedAtMs: 2000 }),
    ];

    const result = reduceDmOperations(ops);

    expect(result.messages).toHaveLength(0);
    expect(result.tombstones.has("msg1")).toBe(true);
  });

  it("upsert then delete then upsert = message invisible (delete persists)", () => {
    // Message exists, deleted, then "restored" from backup/sync
    const ops: DmOperation[] = [
      createUpsert({ opId: "op1", messageId: "msg1", identityIds: ["msg1"], observedAtMs: 1000 }),
      createDelete({ opId: "op2", targetIdentityIds: ["msg1"], observedAtMs: 2000 }),
      createUpsert({ opId: "op3", messageId: "msg1", identityIds: ["msg1"], observedAtMs: 3000 }),
    ];

    const result = reduceDmOperations(ops);

    expect(result.messages).toHaveLength(0);
  });

  it("delete by alias prevents resurrection by any other alias", () => {
    // User deletes by optimistic UUID, but restore brings back by relay event ID
    const ops: DmOperation[] = [
      createUpsert({
        opId: "op1",
        messageId: "optimistic-uuid",
        identityIds: ["optimistic-uuid", "relay-event-id"],
        eventId: "relay-event-id",
        observedAtMs: 1000,
      }),
      createDelete({ opId: "op2", targetIdentityIds: ["optimistic-uuid"], observedAtMs: 2000 }),
      // Restore tries to bring back with relay event ID
      createUpsert({
        opId: "op3",
        messageId: "optimistic-uuid",
        identityIds: ["optimistic-uuid", "relay-event-id"],
        eventId: "relay-event-id",
        observedAtMs: 3000,
      }),
    ];

    const result = reduceDmOperations(ops);

    // Message should NOT be visible - tombstone on optimistic-uuid blocks resurrection
    expect(result.messages).toHaveLength(0);
    expect(result.tombstones.has("optimistic-uuid")).toBe(true);
  });

  it("batch delete of multiple messages prevents all from resurrecting", () => {
    const ops: DmOperation[] = [
      createUpsert({ opId: "op1", messageId: "msg1", identityIds: ["msg1"], observedAtMs: 1000 }),
      createUpsert({ opId: "op2", messageId: "msg2", identityIds: ["msg2"], observedAtMs: 1000 }),
      createUpsert({ opId: "op3", messageId: "msg3", identityIds: ["msg3"], observedAtMs: 1000 }),
      createDelete({ opId: "op4", targetIdentityIds: ["msg1", "msg2", "msg3"], observedAtMs: 2000 }),
      // Restore all
      createUpsert({ opId: "op5", messageId: "msg1", identityIds: ["msg1"], observedAtMs: 3000 }),
      createUpsert({ opId: "op6", messageId: "msg2", identityIds: ["msg2"], observedAtMs: 3000 }),
      createUpsert({ opId: "op7", messageId: "msg3", identityIds: ["msg3"], observedAtMs: 3000 }),
    ];

    const result = reduceDmOperations(ops);

    expect(result.messages).toHaveLength(0);
    expect(result.tombstones.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Identity Alias Tests
// ---------------------------------------------------------------------------

describe("dm-operation-reducer > identity aliases", () => {
  it("matches message by any of its identity aliases", () => {
    const ops: DmOperation[] = [
      createUpsert({
        opId: "op1",
        messageId: "optimistic-uuid",
        identityIds: ["optimistic-uuid", "relay-event-id", "rumor-hash-1", "rumor-hash-2"],
        observedAtMs: 1000,
      }),
      // Delete by rumor hash
      createDelete({ opId: "op2", targetIdentityIds: ["rumor-hash-2"], observedAtMs: 2000 }),
    ];

    const result = reduceDmOperations(ops);

    expect(result.messages).toHaveLength(0);
    expect(result.tombstones.has("rumor-hash-2")).toBe(true);
  });

  it("delete with multiple target IDs removes all matching messages", () => {
    const ops: DmOperation[] = [
      createUpsert({ opId: "op1", messageId: "msg1", identityIds: ["msg1"], observedAtMs: 1000 }),
      createUpsert({ opId: "op2", messageId: "msg2", identityIds: ["msg2"], observedAtMs: 1000 }),
      createUpsert({ opId: "op3", messageId: "msg3", identityIds: ["msg3"], observedAtMs: 1000 }),
      // Delete two of them
      createDelete({ opId: "op4", targetIdentityIds: ["msg1", "msg3"], observedAtMs: 2000 }),
    ];

    const result = reduceDmOperations(ops);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.id).toBe("msg2");
  });
});

// ---------------------------------------------------------------------------
// Query Helper Tests
// ---------------------------------------------------------------------------

describe("dm-operation-reducer > query helpers", () => {
  it("isMessageDeletedInProjection returns true for tombstoned IDs", () => {
    const ops: DmOperation[] = [
      createUpsert({ opId: "op1", messageId: "msg1", identityIds: ["msg1"], observedAtMs: 1000 }),
      createDelete({ opId: "op2", targetIdentityIds: ["msg1"], observedAtMs: 2000 }),
    ];

    const result = reduceDmOperations(ops);

    expect(isMessageDeletedInProjection(result, ["msg1"])).toBe(true);
    expect(isMessageDeletedInProjection(result, ["random-id"])).toBe(false);
    expect(isMessageDeletedInProjection(result, ["msg1", "other-id"])).toBe(true); // any match
  });
});

// ---------------------------------------------------------------------------
// Ordering & Time Tests
// ---------------------------------------------------------------------------

describe("dm-operation-reducer > ordering", () => {
  it("orders messages by timestamp desc", () => {
    const msg1: Message = { ...createMessage("msg1"), timestamp: new Date(1_700_000_000_000) };
    const msg2: Message = { ...createMessage("msg2"), timestamp: new Date(1_700_000_001_000) };
    const msg3: Message = { ...createMessage("msg3"), timestamp: new Date(1_700_000_002_000) };

    const ops: DmOperation[] = [
      { ...createUpsert({ opId: "op1", messageId: "msg1", identityIds: ["msg1"] }), message: msg1 },
      { ...createUpsert({ opId: "op2", messageId: "msg2", identityIds: ["msg2"] }), message: msg2 },
      { ...createUpsert({ opId: "op3", messageId: "msg3", identityIds: ["msg3"] }), message: msg3 },
    ];

    const result = reduceDmOperations(ops);

    expect(result.messages[0]?.id).toBe("msg3");
    expect(result.messages[1]?.id).toBe("msg2");
    expect(result.messages[2]?.id).toBe("msg1");
  });

  it("same timestamp: upserts before deletes for determinism", () => {
    // At the exact same millisecond, upserts are processed before deletes
    const ops: DmOperation[] = [
      createUpsert({ opId: "op1", messageId: "msg1", identityIds: ["msg1"], observedAtMs: 1000 }),
      createDelete({ opId: "op2", targetIdentityIds: ["msg1"], observedAtMs: 1000 }),
    ];

    const result = reduceDmOperations(ops);

    // Message should be deleted (upsert first, then delete)
    expect(result.messages).toHaveLength(0);
  });
});
