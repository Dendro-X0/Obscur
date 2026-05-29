import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  isRegisteredCommunityBot,
  normalizeCommunityBotPubkeys,
  parseCommunityBotPubkeyInput,
  readBotPubkeysFromMetadataField,
} from "./community-bot-policy";

const BOT_A = "aa".repeat(32) as PublicKeyHex;
const BOT_B = "bb".repeat(32) as PublicKeyHex;

describe("community-bot-policy", () => {
  it("normalizes and dedupes bot pubkeys", () => {
    expect(normalizeCommunityBotPubkeys([BOT_A, BOT_A.toUpperCase(), "bad", BOT_B])).toEqual([BOT_A, BOT_B]);
  });

  it("reads botPubkeys from metadata field", () => {
    expect(readBotPubkeysFromMetadataField({ botPubkeys: [BOT_A] })).toEqual([]);
    expect(readBotPubkeysFromMetadataField([BOT_A, BOT_B])).toEqual([BOT_A, BOT_B]);
  });

  it("detects registered bot author", () => {
    expect(isRegisteredCommunityBot({
      botPubkeys: [BOT_A],
      authorPublicKeyHex: BOT_A,
    })).toBe(true);
    expect(isRegisteredCommunityBot({
      botPubkeys: [BOT_A],
      authorPublicKeyHex: BOT_B,
    })).toBe(false);
  });

  it("parses valid bot pubkey input", () => {
    expect(parseCommunityBotPubkeyInput(`  ${BOT_A}  `)).toBe(BOT_A);
    expect(parseCommunityBotPubkeyInput("not-hex")).toBeNull();
  });
});
