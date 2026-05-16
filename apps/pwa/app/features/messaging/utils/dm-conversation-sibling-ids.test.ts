import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { buildDmSiblingConversationIds, inferPeerFromConversationId } from "./dm-conversation-sibling-ids";

const my = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as PublicKeyHex;
const peer = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as PublicKeyHex;

describe("dm-conversation-sibling-ids", () => {
  it("inferPeerFromConversationId returns peer for canonical sorted id", () => {
    const cid = [my, peer].sort().join(":");
    expect(inferPeerFromConversationId({ conversationId: cid, myPublicKeyHex: my })).toBe(peer);
  });

  it("buildDmSiblingConversationIds includes canonical and ordered variants for DM", () => {
    const ids = buildDmSiblingConversationIds({
      conversationId: peer,
      myPublicKeyHex: my,
    });
    expect(ids).toContain(peer);
    expect(ids).toContain(`${my}:${peer}`);
    expect(ids).toContain(`${peer}:${my}`);
    expect(ids).toContain([my, peer].sort().join(":"));
  });

  it("buildDmSiblingConversationIds for group returns trimmed single id", () => {
    const gid = "group:abc123";
    expect(buildDmSiblingConversationIds({ conversationId: `  ${gid}  `, myPublicKeyHex: my })).toEqual([gid]);
  });
});
