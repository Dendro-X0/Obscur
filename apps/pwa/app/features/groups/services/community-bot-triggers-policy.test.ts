import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  countEnabledBotTriggerRules,
  isBotInboundTriggersEnabled,
  normalizeBotTriggersForDescriptor,
  readBotTriggersFromMetadataField,
  sanitizeBotTriggersForAllowlist,
} from "./community-bot-triggers-policy";

const BOT_A = "aa".repeat(32) as PublicKeyHex;
const BOT_B = "bb".repeat(32) as PublicKeyHex;

describe("community-bot-triggers-policy", () => {
  it("normalizes keyword trigger entries", () => {
    const parsed = readBotTriggersFromMetadataField([{
      botPubkey: BOT_A,
      enabled: true,
      triggers: [{
        kind: "keyword",
        enabled: true,
        reply: "pong",
        keywords: ["ping", "PING"],
      }],
    }]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.triggers[0]?.keywords).toEqual(["ping"]);
  });

  it("drops invalid trigger kinds and empty keyword lists", () => {
    expect(readBotTriggersFromMetadataField([{
      botPubkey: BOT_A,
      enabled: true,
      triggers: [
        { kind: "keyword", enabled: true, reply: "x", keywords: [] },
        { kind: "unknown", enabled: true, reply: "x" },
      ],
    }])).toEqual([]);
  });

  it("sanitizes triggers to registered bot allowlist", () => {
    const triggers = readBotTriggersFromMetadataField([{
      botPubkey: BOT_B,
      enabled: true,
      triggers: [{ kind: "mention", enabled: true, reply: "hi" }],
    }]);
    expect(sanitizeBotTriggersForAllowlist({ botTriggers: triggers, botPubkeys: [BOT_A] })).toEqual([]);
    expect(normalizeBotTriggersForDescriptor(triggers, [BOT_B])).toHaveLength(1);
  });

  it("reports enabled inbound triggers per bot", () => {
    const triggers = readBotTriggersFromMetadataField([{
      botPubkey: BOT_A,
      enabled: false,
      triggers: [{ kind: "mention", enabled: true, reply: "hi" }],
    }]);
    expect(isBotInboundTriggersEnabled({ botTriggers: triggers, botPubkey: BOT_A })).toBe(false);
    expect(countEnabledBotTriggerRules(triggers)).toBe(0);
  });
});
