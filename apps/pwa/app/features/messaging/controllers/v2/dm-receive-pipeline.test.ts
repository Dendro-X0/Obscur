import { describe, it, expect, vi, beforeEach } from "vitest";
import { processIncomingEvent, dmReceivePipelineInternals } from "./dm-receive-pipeline";

vi.mock("@/app/features/crypto/crypto-service", () => ({
  cryptoService: {
    decryptDM: vi.fn(async (content: string) => content.replace("encrypted:", "")),
    decryptGiftWrap: vi.fn(async (event: { id: string; content: string; pubkey: string; created_at: number }) => ({
      id: "rumor-" + event.id,
      kind: 14,
      pubkey: "sender-" + event.pubkey.slice(0, 8),
      created_at: event.created_at,
      content: event.content.replace("wrapped:", ""),
      tags: [["p", "recipient-pubkey"]],
    })),
  },
}));

vi.mock("../../services/message-delete-tombstone-store", () => ({
  isMessageDeleteSuppressed: vi.fn(() => false),
}));

const myPubkey = "a".repeat(64);
const myPrivkey = "b".repeat(64) as any;
const peerPubkey = "c".repeat(64);

const makeNip04Event = (overrides?: Partial<{ id: string; pubkey: string; content: string; created_at: number; tags: string[][] }>) => ({
  id: overrides?.id ?? "event-id-" + Math.random().toString(36).slice(2, 10),
  kind: 4,
  pubkey: overrides?.pubkey ?? peerPubkey,
  created_at: overrides?.created_at ?? Math.floor(Date.now() / 1000),
  content: overrides?.content ?? "encrypted:hello world",
  tags: overrides?.tags ?? [["p", myPubkey]],
  sig: "sig-mock",
});

const makeNip17Event = (overrides?: Partial<{ id: string; pubkey: string; content: string; created_at: number }>) => ({
  id: overrides?.id ?? "giftwrap-" + Math.random().toString(36).slice(2, 10),
  kind: 1059,
  pubkey: overrides?.pubkey ?? "random-wrapper-" + peerPubkey.slice(0, 48),
  created_at: overrides?.created_at ?? Math.floor(Date.now() / 1000),
  content: overrides?.content ?? "wrapped:hey there",
  tags: [["p", myPubkey]],
  sig: "giftwrap-sig",
});

describe("dm-receive-pipeline", () => {
  beforeEach(() => {
    dmReceivePipelineInternals.processedEventIds.clear();
    vi.clearAllMocks();
  });

  it("processes a NIP-04 incoming DM", async () => {
    const event = makeNip04Event();
    const result = await processIncomingEvent({
      event,
      relayUrl: "wss://relay1.example.com",
      ingestSource: "relay_live",
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
    });

    expect(result.action).toBe("message");
    if (result.action === "message") {
      expect(result.message.content).toBe("hello world");
      expect(result.message.isOutgoing).toBe(false);
      expect(result.message.status).toBe("delivered");
      expect(result.message.senderPubkey).toBe(peerPubkey);
    }
  });

  it("processes a NIP-17 gift-wrapped DM", async () => {
    const event = makeNip17Event();
    const result = await processIncomingEvent({
      event,
      relayUrl: "wss://relay1.example.com",
      ingestSource: "relay_live",
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
    });

    expect(result.action).toBe("message");
    if (result.action === "message") {
      expect(result.message.content).toBe("hey there");
      expect(result.message.isOutgoing).toBe(false);
    }
  });

  it("deduplicates events by ID", async () => {
    const event = makeNip04Event({ id: "duplicate-event-id" });
    const r1 = await processIncomingEvent({
      event,
      relayUrl: "wss://relay1.example.com",
      ingestSource: "relay_live",
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
    });
    const r2 = await processIncomingEvent({
      event,
      relayUrl: "wss://relay2.example.com",
      ingestSource: "relay_live",
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
    });

    expect(r1.action).toBe("message");
    expect(r2.action).toBe("skipped");
    if (r2.action === "skipped") {
      expect(r2.reason).toBe("already_processed");
    }
  });

  it("recognizes self-authored messages", async () => {
    const event = makeNip04Event({
      pubkey: myPubkey,
      tags: [["p", peerPubkey]],
    });
    const result = await processIncomingEvent({
      event,
      relayUrl: "wss://relay1.example.com",
      ingestSource: "relay_live",
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
    });

    expect(result.action).toBe("self_echo");
    if (result.action === "self_echo") {
      expect(result.message.isOutgoing).toBe(true);
    }
  });

  it("blocks messages from blocked senders", async () => {
    const event = makeNip04Event();
    const result = await processIncomingEvent({
      event,
      relayUrl: "wss://relay1.example.com",
      ingestSource: "relay_live",
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      blocklist: {
        isBlocked: ({ publicKeyHex }) => publicKeyHex === peerPubkey,
      },
    });

    expect(result.action).toBe("skipped");
    if (result.action === "skipped") {
      expect(result.reason).toBe("blocked_sender");
    }
  });

  it("processes delete commands", async () => {
    const deletePayload = JSON.stringify({ type: "delete", targetMessageId: "msg-to-delete" });
    const event = makeNip04Event({ content: `encrypted:${deletePayload}` });
    const result = await processIncomingEvent({
      event,
      relayUrl: "wss://relay1.example.com",
      ingestSource: "relay_live",
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
    });

    expect(result.action).toBe("delete");
    if (result.action === "delete") {
      expect(result.targetMessageIds).toEqual(["msg-to-delete"]);
    }
  });

  it("processes batch delete commands", async () => {
    const deletePayload = JSON.stringify({ type: "delete", targetMessageIds: ["msg-1", "msg-2", "msg-3"] });
    const event = makeNip04Event({ content: `encrypted:${deletePayload}` });
    const result = await processIncomingEvent({
      event,
      relayUrl: "wss://relay1.example.com",
      ingestSource: "relay_live",
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
    });

    expect(result.action).toBe("delete");
    if (result.action === "delete") {
      expect(result.targetMessageIds).toEqual(["msg-1", "msg-2", "msg-3"]);
    }
  });

  it("processes __dweb_cmd__ prefixed delete commands", async () => {
    const deletePayload = `__dweb_cmd__${JSON.stringify({ type: "delete", targetMessageId: "msg-prefixed-delete" })}`;
    const event = makeNip04Event({
      content: `encrypted:${deletePayload}`,
      tags: [["p", myPubkey], ["t", "message-delete"], ["e", "msg-prefixed-delete"], ["e", "msg-alias-id"]],
    });
    const result = await processIncomingEvent({
      event,
      relayUrl: "wss://relay1.example.com",
      ingestSource: "relay_live",
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
    });

    expect(result.action).toBe("delete");
    if (result.action === "delete") {
      expect(result.targetMessageIds).toContain("msg-prefixed-delete");
      expect(result.targetMessageIds).toContain("msg-alias-id");
    }
  });

  it("rejects invalid events", async () => {
    const result = await processIncomingEvent({
      event: { id: "", kind: 4, pubkey: "", content: "", tags: [], sig: "", created_at: 0 },
      relayUrl: "wss://relay1.example.com",
      ingestSource: "relay_live",
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
    });

    expect(result.action).toBe("skipped");
    if (result.action === "skipped") {
      expect(result.reason).toBe("invalid_event");
    }
  });

  it("skips tombstoned messages", async () => {
    const { isMessageDeleteSuppressed } = await import("../../services/message-delete-tombstone-store");
    vi.mocked(isMessageDeleteSuppressed).mockReturnValueOnce(true);

    const event = makeNip04Event({ id: "tombstoned-event" });
    const result = await processIncomingEvent({
      event,
      relayUrl: "wss://relay1.example.com",
      ingestSource: "relay_live",
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
    });

    expect(result.action).toBe("skipped");
    if (result.action === "skipped") {
      expect(result.reason).toBe("tombstoned");
    }
  });
});
