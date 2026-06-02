import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSealedCommunityAnnouncementEvent,
  decryptGroupMessage,
  encryptGroupMessage,
} from "./lib/community-bot-crypto.mjs";
import {
  createRateLimiter,
  findMatchingInboundTrigger,
  formatTriggerReply,
  matchKeywordTrigger,
  matchMentionTrigger,
  parseSealedChatInner,
} from "./lib/community-bot-inbound.mjs";
import { normalizeCommunityBotTriggers } from "./lib/community-bot-triggers-contracts.mjs";

const BOT = "aa".repeat(32);
const ROOM_KEY = "11".repeat(32);

describe("community-inbound-bot", () => {
  it("round-trips sealed inner kind 9 decrypt", async () => {
    const inner = JSON.stringify({
      kind: 9,
      content: "ping help",
      created_at: 1_700_000_000,
      pubkey: "bb".repeat(32),
    });
    const cipher = await encryptGroupMessage(inner, ROOM_KEY);
    const decrypted = await decryptGroupMessage(cipher, ROOM_KEY);
    const parsed = parseSealedChatInner(decrypted);
    assert.equal(parsed?.content, "ping help");
    assert.equal(parsed?.authorPublicKeyHex, "bb".repeat(32));
  });

  it("matches keyword and mention triggers", () => {
    assert.equal(matchKeywordTrigger({ content: "Need HELP now", keywords: ["help"] }), true);
    assert.equal(matchMentionTrigger({
      content: `hey @${BOT.slice(0, 8)} check this`,
      botPublicKeyHex: BOT,
    }), true);
  });

  it("finds first enabled inbound rule", () => {
    const entry = normalizeCommunityBotTriggers([{
      botPubkey: BOT,
      enabled: true,
      triggers: [
        { kind: "keyword", enabled: true, reply: "pong", keywords: ["ping"] },
        { kind: "mention", enabled: true, reply: "mentioned" },
      ],
    }])[0];
    const keywordRule = findMatchingInboundTrigger({
      entry,
      botPublicKeyHex: BOT,
      content: "please ping me",
    });
    assert.equal(keywordRule?.kind, "keyword");
  });

  it("formats reply template placeholders", () => {
    const text = formatTriggerReply("Hi {{author}} — saw: {{content}}", {
      authorPublicKeyHex: "bb".repeat(32),
      content: "hello",
    });
    assert.match(text, /Hi bbbbbbbb/);
    assert.match(text, /hello$/);
  });

  it("rate limiter enforces per-minute cap", () => {
    const limiter = createRateLimiter(2);
    assert.equal(limiter.tryConsume(0), true);
    assert.equal(limiter.tryConsume(1), true);
    assert.equal(limiter.tryConsume(2), false);
    assert.equal(limiter.tryConsume(60_001), true);
  });

  it("builds sealed reply event", async () => {
    const privateKeyHex = "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb";
    const event = await buildSealedCommunityAnnouncementEvent({
      privateKeyHex,
      groupId: "group-1",
      roomKeyHex: ROOM_KEY,
      content: "auto reply",
    });
    assert.equal(event.kind, 10105);
  });
});
