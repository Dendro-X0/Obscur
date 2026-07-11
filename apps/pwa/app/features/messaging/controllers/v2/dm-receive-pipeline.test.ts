import { describe, it, expect, vi, beforeEach } from "vitest";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { processIncomingEvent, createDedupSet } from "./dm-receive-pipeline";

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

vi.mock("../../services/messaging-client-operations", () => ({
  messagingClientOperations: {
    isDmMessageSuppressed: vi.fn(() => false),
    isDmMessageIdentitySuppressed: vi.fn(() => false),
  },
}));

vi.mock("@/app/features/relays/utils/nip65-service", () => ({
  nip65Service: {
    getWriteRelays: vi.fn(() => []),
  },
}));

vi.mock("../../services/peer-relay-evidence-store", () => ({
  peerRelayEvidenceStore: {
    getRelayUrls: vi.fn(() => []),
    subscribe: vi.fn(() => () => {}),
  },
}));

const myPubkey = "a".repeat(64);
const myPrivkey = "b".repeat(64) as import("@dweb/crypto/private-key-hex").PrivateKeyHex;
const peerPubkey = "c".repeat(64);

const acceptedPeerTrust = {
  isAccepted: () => true,
  acceptPeer: vi.fn(),
};

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
  let dedupSet: Set<string>;

  beforeEach(() => {
    dedupSet = createDedupSet();
    vi.clearAllMocks();
  });

  it("processes a NIP-04 incoming DM", async () => {
    const event = makeNip04Event();
    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      peerTrust: acceptedPeerTrust,
      dedupSet,
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
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      peerTrust: acceptedPeerTrust,
      dedupSet,
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
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      peerTrust: acceptedPeerTrust,
      dedupSet,
    });
    const r2 = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      peerTrust: acceptedPeerTrust,
      dedupSet,
    });

    expect(r1.action).toBe("message");
    expect(r2.action).toBe("skipped");
    if (r2.action === "skipped") {
      expect(r2.reason).toBe("dedup");
    }
  });

  it("does not mark decrypt-failed events as processed", async () => {
    vi.mocked(cryptoService.decryptDM).mockRejectedValueOnce(new Error("decrypt failed"));
    const event = makeNip04Event({ id: "retry-after-decrypt-failure" });

    const r1 = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      dedupSet,
    });
    const r2 = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      peerTrust: acceptedPeerTrust,
      dedupSet,
    });

    expect(r1.action).toBe("skipped");
    if (r1.action === "skipped") {
      expect(r1.reason).toBe("decrypt failed");
    }
    expect(r2.action).toBe("message");
  });

  it("recognizes self-authored messages", async () => {
    const event = makeNip04Event({
      pubkey: myPubkey,
      tags: [["p", peerPubkey]],
    });
    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      dedupSet,
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
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      blocklist: {
        isBlocked: ({ publicKeyHex }) => publicKeyHex === peerPubkey,
      },
      dedupSet,
    });

    expect(result.action).toBe("skipped");
    if (result.action === "skipped") {
      expect(result.reason).toBe("blocked");
    }
  });

  it("processes delete commands", async () => {
    const deletePayload = JSON.stringify({ type: "delete", targetMessageId: "msg-to-delete" });
    const event = makeNip04Event({ content: `encrypted:${deletePayload}` });
    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      dedupSet,
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
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      dedupSet,
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
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      dedupSet,
    });

    expect(result.action).toBe("delete");
    if (result.action === "delete") {
      expect(result.targetMessageIds).toContain("msg-prefixed-delete");
      expect(result.targetMessageIds).toContain("msg-alias-id");
    }
  });

  it("processes versioned delete commands without surfacing them as messages", async () => {
    const deletePayload = `__dweb_cmd__delete:${JSON.stringify({
      type: "message_delete_v1",
      mode: "delete_for_everyone",
      conversationId: [myPubkey, peerPubkey].sort().join(":"),
      targetMessageIdentityIds: ["local-id", "event-id"],
      targetAuthorPubkey: peerPubkey,
      deletedByPubkey: peerPubkey,
      deletedAt: Date.now(),
      nonce: "nonce-1",
    })}`;
    const event = makeNip04Event({
      content: `encrypted:${deletePayload}`,
      tags: [["p", myPubkey], ["t", "message-delete"], ["e", "event-id"], ["e", "relay-extra-id"]],
    });
    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      dedupSet,
    });

    expect(result.action).toBe("delete");
    if (result.action === "delete") {
      expect(new Set(result.targetMessageIds)).toEqual(new Set(["local-id", "event-id", "relay-extra-id"]));
      expect(result.plaintext).toBe(deletePayload);
    }
  });

  it("classifies versioned delete with leading whitespace (trim) so prefix decode succeeds", async () => {
    const inner = `__dweb_cmd__delete:${JSON.stringify({
      type: "message_delete_v1",
      mode: "delete_for_everyone",
      conversationId: [myPubkey, peerPubkey].sort().join(":"),
      targetMessageIdentityIds: ["evt-trim-test"],
      targetAuthorPubkey: peerPubkey,
      deletedByPubkey: peerPubkey,
      deletedAt: Date.now(),
      nonce: "nonce-trim",
    })}`;
    const deletePayload = `\n  ${inner}`;
    const event = makeNip04Event({
      content: `encrypted:${deletePayload}`,
      tags: [["p", myPubkey], ["t", "message-delete"], ["e", "evt-trim-test"]],
    });
    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      dedupSet,
    });

    expect(result.action).toBe("delete");
    if (result.action === "delete") {
      expect(result.targetMessageIds).toContain("evt-trim-test");
    }
  });

  it("round-trips encodeDmDeleteCommandV1 (same encoder as delete-for-everyone send) through the receive classifier", async () => {
    const { encodeDmDeleteCommandV1 } = await import("../../deletion/delete-command-codec");
    const conversationId = [myPubkey, peerPubkey].sort().join(":");
    const deletePayload = encodeDmDeleteCommandV1({
      conversationId,
      targetMessageIdentityIds: ["prod-encode-id-a", "prod-encode-id-b"],
      targetAuthorPubkey: peerPubkey as import("@dweb/crypto/public-key-hex").PublicKeyHex,
      deletedByPubkey: peerPubkey as import("@dweb/crypto/public-key-hex").PublicKeyHex,
    });
    const event = makeNip04Event({
      content: `encrypted:${deletePayload}`,
      tags: [["p", myPubkey], ["t", "message-delete"], ["e", "prod-encode-id-a"]],
    });
    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      dedupSet,
    });
    expect(result.action).toBe("delete");
    if (result.action === "delete") {
      expect(new Set(result.targetMessageIds)).toEqual(new Set(["prod-encode-id-a", "prod-encode-id-b"]));
    }
  });

  it("rejects invalid events", async () => {
    const result = await processIncomingEvent({
      event: { id: "", kind: 4, pubkey: "", content: "", tags: [], sig: "", created_at: 0 },
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      dedupSet,
    });

    expect(result.action).toBe("skipped");
    if (result.action === "skipped") {
      expect(result.reason).toBe("no_peer_pubkey");
    }
  });

  it("skips tombstoned messages", async () => {
    const { messagingClientOperations } = await import("../../services/messaging-client-operations");
    vi.mocked(messagingClientOperations.isDmMessageSuppressed).mockReturnValueOnce(true);

    const event = makeNip04Event({ id: "tombstoned-event" });
    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      dedupSet,
    });

    expect(result.action).toBe("skipped");
    if (result.action === "skipped") {
      expect(result.reason).toBe("tombstoned");
    }
  });

  it("routes connection-request to contact_sandbox", async () => {
    const event = makeNip04Event({
      content: "encrypted:I'd like to connect",
      tags: [["p", myPubkey], ["t", "connection-request"]],
    });
    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      dedupSet,
    });

    expect(result.action).toBe("contact_sandbox");
    if (result.action === "contact_sandbox") {
      expect(result.lifecycleTag).toBe("connection-request");
      expect(result.message.content).toBe("I'd like to connect");
      expect(result.isSelfAuthored).toBe(false);
    }
  });

  it("routes connection-qna to contact_sandbox while pending", async () => {
    const event = makeNip04Event({
      content: "encrypted:Who referred you?",
      tags: [["p", myPubkey], ["t", "connection-qna"]],
    });
    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      requestsInbox: {
        getRequestStatus: () => ({ status: "pending", isOutgoing: false }),
        setStatus: vi.fn(),
        upsertIncoming: vi.fn(),
      },
      dedupSet,
    });

    expect(result.action).toBe("contact_sandbox");
    if (result.action === "contact_sandbox") {
      expect(result.lifecycleTag).toBe("connection-qna");
    }
  });

  it("rejects connection-qna when handshake is not pending", async () => {
    const event = makeNip04Event({
      content: "encrypted:late qna",
      tags: [["p", myPubkey], ["t", "connection-qna"]],
    });
    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      requestsInbox: {
        getRequestStatus: () => ({ status: "accepted", isOutgoing: false }),
        setStatus: vi.fn(),
        upsertIncoming: vi.fn(),
      },
      dedupSet,
    });

    expect(result.action).toBe("skipped");
    if (result.action === "skipped") {
      expect(result.reason).toBe("contact_qna_not_pending");
    }
  });

  it("routes connection-accept to contact_lifecycle", async () => {
    const event = makeNip04Event({
      content: "encrypted:Accepted",
      tags: [["p", myPubkey], ["t", "connection-accept"], ["e", "req-event-id"]],
    });
    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      dedupSet,
    });

    expect(result.action).toBe("contact_lifecycle");
    if (result.action === "contact_lifecycle") {
      expect(result.lifecycleTag).toBe("connection-accept");
      expect(result.requestEventId).toBe("req-event-id");
      expect(result.peerPublicKeyHex).toBe(peerPubkey);
    }
  });

  it("blocks untagged stranger DMs", async () => {
    const event = makeNip04Event({ content: "encrypted:hey stranger" });
    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPubkey,
      myPrivateKeyHex: myPrivkey,
      peerTrust: {
        isAccepted: () => false,
        acceptPeer: vi.fn(),
      },
      requestsInbox: {
        getRequestStatus: () => null,
        setStatus: vi.fn(),
        upsertIncoming: vi.fn(),
      },
      dedupSet,
    });

    expect(result.action).toBe("skipped");
    if (result.action === "skipped") {
      expect(result.reason).toBe("stranger_dm_blocked");
    }
  });
});
