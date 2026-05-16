import { describe, expect, it } from "vitest";
import {
  dmConversationIdsMatch,
  resolveDmCounterpartyPubkey,
  toDmConversationId,
  toDmConversationIdFromEvent,
} from "./dm-conversation-id";

describe("dmConversationIdsMatch", () => {
  const myPubkey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const peerPubkey = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  it("matches identical ids", () => {
    const canonical = toDmConversationId({ myPublicKeyHex: myPubkey, peerPublicKeyHex: peerPubkey });
    expect(canonical).toBeTruthy();
    expect(dmConversationIdsMatch(canonical!, canonical!, myPubkey, peerPubkey)).toBe(true);
  });

  it("matches legacy raw sort ids to canonical normalized ids", () => {
    const canonical = toDmConversationId({ myPublicKeyHex: myPubkey, peerPublicKeyHex: peerPubkey })!;
    const legacy = [myPubkey.toUpperCase(), peerPubkey.toUpperCase()].sort().join(":");
    expect(dmConversationIdsMatch(legacy, canonical, myPubkey, peerPubkey)).toBe(true);
  });

  it("rejects unrelated conversation ids", () => {
    const canonical = toDmConversationId({ myPublicKeyHex: myPubkey, peerPublicKeyHex: peerPubkey })!;
    expect(dmConversationIdsMatch("other:thread", canonical, myPubkey, peerPubkey)).toBe(false);
  });
});

describe("toDmConversationIdFromEvent", () => {
  const myPubkey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const peerPubkey = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  it("uses sender pubkey for peer-authored events", () => {
    const conversationId = toDmConversationIdFromEvent({
      myPublicKeyHex: myPubkey,
      senderPubkey: peerPubkey,
    });
    expect(conversationId).toBe(toDmConversationId({ myPublicKeyHex: myPubkey, peerPublicKeyHex: peerPubkey }));
  });

  it("uses #p tag recipient for self-authored delete commands", () => {
    const conversationId = toDmConversationIdFromEvent({
      myPublicKeyHex: myPubkey,
      senderPubkey: myPubkey,
      tags: [["p", peerPubkey]],
    });
    expect(conversationId).toBe(toDmConversationId({ myPublicKeyHex: myPubkey, peerPublicKeyHex: peerPubkey }));
    expect(resolveDmCounterpartyPubkey({
      myPublicKeyHex: myPubkey,
      senderPubkey: myPubkey,
      tags: [["p", peerPubkey]],
    })).toBe(peerPubkey);
  });
});
