/**
 * Message Deletion Coordinator Tests
 *
 * Core deletion logic tests covering permission matrix and tombstone creation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MessageIdentity, MessageTombstone } from "./types";
import {
  canDeleteForMe,
  canDeleteForEveryone,
  deleteMessageForMe,
  deleteMessageForEveryone,
  commitNetworkDeleteTombstone,
  processIncomingDmDeleteCommand,
  processIncomingCommunityDeleteCommand,
  registerDeletionEventBus,
} from "./message-deletion-coordinator";
import { loadMessageTombstones, clearMessageTombstones } from "./message-tombstone-store";
import { loadMessageDeleteTombstoneEntries } from "../services/message-delete-tombstone-store";

const executeDmDeleteForMeMock = vi.hoisted(() => vi.fn(
  async (params: Readonly<{ messageIdentityIds: ReadonlyArray<string> }>) => (
    params.messageIdentityIds.map((id) => id.trim()).filter((id) => id.length > 0)
  ),
));

vi.mock("@/app/features/messaging/services/dm-local-delete-persistence", () => ({
  executeDmDeleteForMe: executeDmDeleteForMeMock,
}));

// Mock resolved profile id for deletion coordinator
vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "test-profile-1"),
  getProfileRuntimeScope: vi.fn(() => null),
}));

// Mock localStorage
const localStorageMock = {
  store: new Map<string, string>(),
  getItem(key: string) {
    return this.store.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    this.store.set(key, value);
  },
  removeItem(key: string) {
    this.store.delete(key);
  },
  clear() {
    this.store.clear();
  },
};

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

// Mock crypto.randomUUID
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: () => `uuid-${Date.now()}-${Math.random()}`,
  },
});

describe("Message Deletion Coordinator", () => {
  const mockProfileId = "test-profile-1";
  const myPubkey = "0000000000000000000000000000000000000000000000000000000000000001" as import("@dweb/crypto/public-key-hex").PublicKeyHex;
  const peerPubkey = "0000000000000000000000000000000000000000000000000000000000000002" as import("@dweb/crypto/public-key-hex").PublicKeyHex;
  const conversationId = `${[myPubkey, peerPubkey].sort().join(":")}`;

  const createMockMessage = (sender: string, id: string): MessageIdentity => ({
    canonicalId: id,
    identityIds: [id, `event-${id}`],
    conversationId,
    senderPubkey: sender as import("@dweb/crypto/public-key-hex").PublicKeyHex,
    createdAt: Date.now(),
  });

  beforeEach(async () => {
    // Clear tombstones
    await clearMessageTombstones(mockProfileId);
    localStorageMock.clear();
  });

  // ---------------------------------------------------------------------------
  // Permission Matrix
  // ---------------------------------------------------------------------------

  describe("canDeleteForMe", () => {
    it("always allows delete for me", () => {
      const result = canDeleteForMe();
      expect(result.allowed).toBe(true);
    });
  });

  describe("canDeleteForEveryone", () => {
    it("allows deleting own messages", () => {
      const myMessage = createMockMessage(myPubkey, "msg-1");
      const result = canDeleteForEveryone(myMessage, myPubkey);
      expect(result.allowed).toBe(true);
    });

    it("rejects deleting peer messages", () => {
      const peerMessage = createMockMessage(peerPubkey, "msg-2");
      const result = canDeleteForEveryone(peerMessage, myPubkey);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe("delete_for_everyone_only_allowed_for_own_messages");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Delete for Me
  // ---------------------------------------------------------------------------

  describe("deleteMessageForMe", () => {
    it("delegates to local DM visibility and emits a local tombstone event", async () => {
      const message = createMockMessage(myPubkey, "msg-1");
      const events: { tombstone: MessageTombstone }[] = [];

      registerDeletionEventBus({
        emit: (e) => events.push(e),
        emitFailure: () => {},
      });

      const result = await deleteMessageForMe({
        profileId: mockProfileId,
        conversationId,
        targetMessage: message,
        accountPublicKeyHex: myPubkey,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(executeDmDeleteForMeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId,
          profileId: mockProfileId,
          accountPublicKeyHex: myPubkey,
          messageIdentityIds: message.identityIds,
        }),
      );
      expect(result.tombstone.scope).toBe("local");
      expect(result.tombstone.reason).toBe("delete_for_me");
      expect(result.tombstone.targetMessageIdentityIds).toEqual(message.identityIds);
      expect(result.tombstone.deletedByPubkey).toBe(myPubkey);

      expect(events).toHaveLength(1);
      expect(events[0].tombstone.tombstoneId).toBe(result.tombstone.tombstoneId);
    });

    it("delegates delete-for-me on peer messages with the viewer pubkey", async () => {
      const peerMessage = createMockMessage(peerPubkey, "msg-2");

      const result = await deleteMessageForMe({
        profileId: mockProfileId,
        conversationId,
        targetMessage: peerMessage,
        accountPublicKeyHex: myPubkey,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.tombstone.scope).toBe("local");
      expect(result.tombstone.targetAuthorPubkey).toBe(peerPubkey);
      expect(result.tombstone.deletedByPubkey).toBe(myPubkey);
    });
  });

  // ---------------------------------------------------------------------------
  // Delete for Everyone
  // ---------------------------------------------------------------------------

  describe("deleteMessageForEveryone", () => {
    it("creates a network tombstone for own message", async () => {
      const message = createMockMessage(myPubkey, "msg-1");
      const events: { tombstone: MessageTombstone }[] = [];

      registerDeletionEventBus({
        emit: (e) => events.push(e),
        emitFailure: () => {},
      });

      const result = await deleteMessageForEveryone({
        profileId: mockProfileId,
        conversationId,
        targetMessage: message,
        myPublicKeyHex: myPubkey,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.tombstone.scope).toBe("network");
      expect(result.tombstone.reason).toBe("delete_for_everyone");
      expect(result.tombstone.commandEventId).toBe("pending");
      expect(result.commandPayload).toContain("__dweb_cmd__delete:");

      // Verify stored
      const stored = await loadMessageTombstones(mockProfileId);
      expect(stored).toHaveLength(1);
      expect(stored[0].scope).toBe("network");
      expect(loadMessageDeleteTombstoneEntries(Date.now(), mockProfileId)).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "msg-1" }),
        expect.objectContaining({ id: "event-msg-1" }),
      ]));
    });

    it("defers local tombstone until commitNetworkDeleteTombstone", async () => {
      const message = createMockMessage(myPubkey, "msg-defer");
      const result = await deleteMessageForEveryone({
        profileId: mockProfileId,
        conversationId,
        targetMessage: message,
        myPublicKeyHex: myPubkey,
      }, { deferLocalTombstone: true });

      expect(result.success).toBe(true);
      if (!result.success) return;

      let stored = await loadMessageTombstones(mockProfileId);
      expect(stored).toHaveLength(0);

      await commitNetworkDeleteTombstone(result.tombstone);
      stored = await loadMessageTombstones(mockProfileId);
      expect(stored).toHaveLength(1);
      expect(stored[0].scope).toBe("network");
    });

    it("rejects deleting peer messages", async () => {
      const peerMessage = createMockMessage(peerPubkey, "msg-2");
      const failures: { error: string; code: string }[] = [];

      registerDeletionEventBus({
        emit: () => {},
        emitFailure: (e) => failures.push({ error: e.error, code: e.code }),
      });

      const result = await deleteMessageForEveryone({
        profileId: mockProfileId,
        conversationId,
        targetMessage: peerMessage,
        myPublicKeyHex: myPubkey,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("permission_denied");
      }
      expect(failures).toHaveLength(1);
      expect(failures[0].code).toBe("permission_denied");

      // Verify no tombstone stored
      const stored = await loadMessageTombstones(mockProfileId);
      expect(stored).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Remote Delete Command Processing
  // ---------------------------------------------------------------------------

  describe("processIncomingDmDeleteCommand", () => {
    it("accepts valid delete command from message author", async () => {
      const message = createMockMessage(peerPubkey, "msg-1");

      // First create the message as if we received it
      // Then process a delete command from the peer (author)

      // Encode a valid delete command
      const { encodeDmDeleteCommandV1 } = await import("./delete-command-codec");
      const commandPayload = encodeDmDeleteCommandV1({
        conversationId,
        targetMessageIdentityIds: message.identityIds,
        targetAuthorPubkey: peerPubkey,
        deletedByPubkey: peerPubkey, // Author deletes their own message
      });

      const events: { tombstone: MessageTombstone }[] = [];
      registerDeletionEventBus({
        emit: (e) => events.push(e),
        emitFailure: () => {},
      });

      const result = await processIncomingDmDeleteCommand(
        commandPayload,
        peerPubkey,
        conversationId,
        "event-delete-1",
        "wss://relay.test",
        myPubkey
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.tombstone.scope).toBe("network");
      expect(result.tombstone.commandEventId).toBe("event-delete-1");
      expect(result.tombstone.relayEvidence).toContain("wss://relay.test");

      // Verify stored
      const stored = await loadMessageTombstones(mockProfileId);
      expect(stored).toHaveLength(1);
      expect(loadMessageDeleteTombstoneEntries(Date.now(), mockProfileId)).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "msg-1" }),
        expect.objectContaining({ id: "event-msg-1" }),
      ]));

      // Verify event emitted
      expect(events).toHaveLength(1);
    });

    it("rejects delete command from non-author", async () => {
      const message = createMockMessage(peerPubkey, "msg-1");
      const attackerPubkey = "0000000000000000000000000000000000000000000000000000000000000003" as import("@dweb/crypto/public-key-hex").PublicKeyHex;

      const { encodeDmDeleteCommandV1 } = await import("./delete-command-codec");
      // Attacker tries to delete peer's message
      const commandPayload = encodeDmDeleteCommandV1({
        conversationId,
        targetMessageIdentityIds: message.identityIds,
        targetAuthorPubkey: peerPubkey,
        deletedByPubkey: attackerPubkey, // Attacker claims they sent it
      });

      const result = await processIncomingDmDeleteCommand(
        commandPayload,
        attackerPubkey,
        conversationId,
        "event-delete-1",
        "wss://relay.test",
        myPubkey
      );

      expect(result.success).toBe(false);
      if ('code' in result) {
        expect(result.code).toBe("permission_denied");
      }

      // Verify no tombstone stored
      const stored = await loadMessageTombstones(mockProfileId);
      expect(stored).toHaveLength(0);
    });

    it("accepts delete command when conversation id differs only by pubkey casing", async () => {
      const { encodeDmDeleteCommandV1 } = await import("./delete-command-codec");
      const authorPubkey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as typeof myPubkey;
      const viewerPubkey = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as typeof peerPubkey;
      const canonicalConversationId = `${[authorPubkey, viewerPubkey].sort().join(":")}`;
      const legacyConversationId = [authorPubkey.toUpperCase(), viewerPubkey.toUpperCase()].sort().join(":");
      const commandPayload = encodeDmDeleteCommandV1({
        conversationId: legacyConversationId,
        targetMessageIdentityIds: ["event-msg-1"],
        targetAuthorPubkey: authorPubkey,
        deletedByPubkey: authorPubkey,
      });

      const result = await processIncomingDmDeleteCommand(
        commandPayload,
        authorPubkey,
        canonicalConversationId,
        "event-delete-casing",
        "wss://relay.test",
        viewerPubkey,
      );

      expect(result.success).toBe(true);
    });

    it("treats duplicate delete commands as idempotent success", async () => {
      const message = createMockMessage(peerPubkey, "msg-1");

      const { encodeDmDeleteCommandV1 } = await import("./delete-command-codec");
      const commandPayload = encodeDmDeleteCommandV1({
        conversationId,
        targetMessageIdentityIds: message.identityIds,
        targetAuthorPubkey: peerPubkey,
        deletedByPubkey: peerPubkey,
      });

      // Process first time
      const result1 = await processIncomingDmDeleteCommand(
        commandPayload,
        peerPubkey,
        conversationId,
        "event-delete-1",
        "wss://relay.test",
        myPubkey
      );
      expect(result1.success).toBe(true);

      // Process same command again
      const result2 = await processIncomingDmDeleteCommand(
        commandPayload,
        peerPubkey,
        conversationId,
        "event-delete-1", // Same event ID
        "wss://relay.test",
        myPubkey
      );
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.tombstone.tombstoneId).toBe(result1.success ? result1.tombstone.tombstoneId : "");
      }

      // Should still only have one tombstone
      const stored = await loadMessageTombstones(mockProfileId);
      expect(stored).toHaveLength(1);
    });
  });

  describe("processIncomingCommunityDeleteCommand", () => {
    const groupId = "test-group-123";
    const relayUrl = "wss://community.relay";

    it("accepts valid community delete from message author", async () => {
      const message = createMockMessage(peerPubkey, "msg-1");

      const { encodeCommunityDeleteCommandV1 } = await import("./delete-command-codec");
      const commandPayload = encodeCommunityDeleteCommandV1({
        groupId,
        relayUrl,
        conversationId: `group:${groupId}`,
        targetMessageIdentityIds: message.identityIds,
        targetAuthorPubkey: peerPubkey,
        deletedByPubkey: peerPubkey,
      });

      const result = await processIncomingCommunityDeleteCommand(
        commandPayload,
        peerPubkey,
        groupId,
        relayUrl,
        "event-delete-1"
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.tombstone.scope).toBe("network");
    });

    it("rejects community delete from non-author", async () => {
      const message = createMockMessage(peerPubkey, "msg-1");
      const attackerPubkey = "0000000000000000000000000000000000000000000000000000000000000003" as import("@dweb/crypto/public-key-hex").PublicKeyHex;

      const { encodeCommunityDeleteCommandV1 } = await import("./delete-command-codec");
      const commandPayload = encodeCommunityDeleteCommandV1({
        groupId,
        relayUrl,
        conversationId: `group:${groupId}`,
        targetMessageIdentityIds: message.identityIds,
        targetAuthorPubkey: peerPubkey,
        deletedByPubkey: attackerPubkey,
      });

      const result = await processIncomingCommunityDeleteCommand(
        commandPayload,
        attackerPubkey,
        groupId,
        relayUrl,
        "event-delete-1"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("permission_denied");
      }
    });

    it("rejects community delete with wrong group context", async () => {
      const message = createMockMessage(peerPubkey, "msg-1");

      const { encodeCommunityDeleteCommandV1 } = await import("./delete-command-codec");
      const commandPayload = encodeCommunityDeleteCommandV1({
        groupId: "wrong-group-id",
        relayUrl,
        conversationId: `group:wrong-group-id`,
        targetMessageIdentityIds: message.identityIds,
        targetAuthorPubkey: peerPubkey,
        deletedByPubkey: peerPubkey,
      });

      const result = await processIncomingCommunityDeleteCommand(
        commandPayload,
        peerPubkey,
        groupId, // Different from command
        relayUrl,
        "event-delete-1"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("invalid_command");
      }
    });
  });
});
