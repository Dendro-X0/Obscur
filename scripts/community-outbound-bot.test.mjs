import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSealedCommunityAnnouncementEvent,
  decodePrivateKeyInput,
  derivePublicKeyHexFromPrivate,
  encryptGroupMessage,
  assertBotPubkeyAllowlisted,
} from "./lib/community-bot-crypto.mjs";

const TEST_PRIVATE_KEY_HEX = "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb";

describe("community-outbound-bot crypto", () => {
  it("builds kind 10105 sealed chat with inner kind 9", async () => {
    const privateKeyHex = TEST_PRIVATE_KEY_HEX;
    const expectedPubkey = derivePublicKeyHexFromPrivate(privateKeyHex);
    const roomKeyHex = "11".repeat(32);
    const groupId = "test-group-id";
    const event = await buildSealedCommunityAnnouncementEvent({
      privateKeyHex,
      groupId,
      roomKeyHex,
      content: "Hello from bot",
    });
    assert.equal(event.kind, 10105);
    assert.equal(event.tags[0][0], "h");
    assert.equal(event.tags[0][1], groupId);
    assert.equal(event.pubkey, expectedPubkey);
    const encryptedPayload = JSON.parse(event.content);
    assert.match(encryptedPayload, /\?v=1$/);
    assert.equal(event.id.length, 64);
    assert.equal(event.sig.length, 128);
  });

  it("encryptGroupMessage uses v=1 suffix", async () => {
    const cipher = await encryptGroupMessage('{"kind":9}', "aa".repeat(32));
    assert.match(cipher, /\?v=1$/);
  });

  it("assertBotPubkeyAllowlisted enforces descriptor list", () => {
    const privateKeyHex = TEST_PRIVATE_KEY_HEX;
    const pubkey = derivePublicKeyHexFromPrivate(privateKeyHex);
    assert.doesNotThrow(() => assertBotPubkeyAllowlisted({
      privateKeyHex,
      allowedBotPubkeys: [pubkey],
    }));
    assert.throws(
      () => assertBotPubkeyAllowlisted({
        privateKeyHex,
        allowedBotPubkeys: ["bb".repeat(32)],
      }),
      /not in OBSCUR_BOT_ALLOWED_PUBKEYS/,
    );
  });

  it("decodePrivateKeyInput accepts hex", () => {
    const hex = "cc".repeat(32);
    assert.equal(decodePrivateKeyInput(hex), hex);
  });
});
