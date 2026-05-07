import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("../../services/message-delete-tombstone-store", () => ({
  suppressMessageDeleteTombstone: vi.fn(),
}));

vi.mock("./dm-send-pipeline", () => ({
  sendDm: vi.fn(),
}));

import { deleteMessages } from "./dm-delete-pipeline";
import { sendDm } from "./dm-send-pipeline";
import { suppressMessageDeleteTombstone } from "../../services/message-delete-tombstone-store";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";

const SENDER_PUB = "aaa".padEnd(64, "0") as PublicKeyHex;
const SENDER_PRIV = "bbb".padEnd(64, "0") as PrivateKeyHex;
const PEER_PUB = "ccc".padEnd(64, "0") as PublicKeyHex;
const CONVERSATION_ID = [SENDER_PUB, PEER_PUB].sort().join(":");

const mockPool = {
  connections: [{ url: "wss://relay.test", status: "open" }],
  subscribe: vi.fn(() => "sub-1"),
  unsubscribe: vi.fn(),
  sendToOpen: vi.fn(),
} as any;

const baseSendResult = {
  success: true,
  deliveryStatus: "sent_quorum" as const,
  messageId: "event-id-123",
  eventId: "event-id-123",
  relayResults: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendDm).mockResolvedValue(baseSendResult);
});

describe("dm-delete-pipeline", () => {
  it("sends delete payload with __dweb_cmd__ prefix", async () => {
    await deleteMessages({
      pool: mockPool,
      senderPublicKeyHex: SENDER_PUB,
      senderPrivateKeyHex: SENDER_PRIV,
      peerPublicKeyHex: PEER_PUB,
      targetMessageIds: ["target-msg-1"],
      conversationId: CONVERSATION_ID,
    });

    expect(sendDm).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(sendDm).mock.calls[0][0];
    expect(callArgs.plaintext).toMatch(/^__dweb_cmd__/);
    expect(callArgs.plaintext).toContain('"type":"delete"');
    expect(callArgs.plaintext).toContain('"targetMessageId":"target-msg-1"');
  });

  it("includes [e, id] tags for each target message ID", async () => {
    await deleteMessages({
      pool: mockPool,
      senderPublicKeyHex: SENDER_PUB,
      senderPrivateKeyHex: SENDER_PRIV,
      peerPublicKeyHex: PEER_PUB,
      targetMessageIds: ["id-a", "id-b", "id-c"],
      conversationId: CONVERSATION_ID,
    });

    const callArgs = vi.mocked(sendDm).mock.calls[0][0];
    expect(callArgs.customTags).toEqual(
      expect.arrayContaining([
        ["t", "message-delete"],
        ["e", "id-a"],
        ["e", "id-b"],
        ["e", "id-c"],
      ]),
    );
  });

  it("tombstones all target IDs before sending", async () => {
    await deleteMessages({
      pool: mockPool,
      senderPublicKeyHex: SENDER_PUB,
      senderPrivateKeyHex: SENDER_PRIV,
      peerPublicKeyHex: PEER_PUB,
      targetMessageIds: ["id-1", "id-2"],
      conversationId: CONVERSATION_ID,
    });

    expect(suppressMessageDeleteTombstone).toHaveBeenCalledWith("id-1", expect.any(Number));
    expect(suppressMessageDeleteTombstone).toHaveBeenCalledWith("id-2", expect.any(Number));
  });

  it("returns empty deletedMessageIds on send failure", async () => {
    vi.mocked(sendDm).mockResolvedValue({
      ...baseSendResult,
      success: false,
      error: "relay offline",
    });

    const result = await deleteMessages({
      pool: mockPool,
      senderPublicKeyHex: SENDER_PUB,
      senderPrivateKeyHex: SENDER_PRIV,
      peerPublicKeyHex: PEER_PUB,
      targetMessageIds: ["id-1"],
      conversationId: CONVERSATION_ID,
    });

    expect(result.success).toBe(false);
    expect(result.deletedMessageIds).toEqual([]);
  });

  it("returns failure for empty target IDs", async () => {
    const result = await deleteMessages({
      pool: mockPool,
      senderPublicKeyHex: SENDER_PUB,
      senderPrivateKeyHex: SENDER_PRIV,
      peerPublicKeyHex: PEER_PUB,
      targetMessageIds: [],
      conversationId: CONVERSATION_ID,
    });

    expect(result.success).toBe(false);
    expect(sendDm).not.toHaveBeenCalled();
  });
});
