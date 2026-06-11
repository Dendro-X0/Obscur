import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  pauseAllBotTriggers,
  readBotTriggersFromMetadataField,
  resolveBotInboundTriggerStatus,
  summarizeCommunityBotTriggerStatuses,
} from "./community-bot-triggers-policy";

const BOT_A = "aa".repeat(32) as PublicKeyHex;
const BOT_B = "bb".repeat(32) as PublicKeyHex;

describe("community-bot-triggers-policy SEC-B3", () => {
  it("reports paused when master switch is off", () => {
    const triggers = readBotTriggersFromMetadataField([{
      botPubkey: BOT_A,
      enabled: false,
      triggers: [{ kind: "mention", enabled: true, reply: "hi" }],
    }]);
    expect(resolveBotInboundTriggerStatus({ botTriggers: triggers, botPubkey: BOT_A })).toBe("paused");
  });

  it("reports unconfigured when bot has no trigger entry", () => {
    expect(resolveBotInboundTriggerStatus({ botTriggers: [], botPubkey: BOT_A })).toBe("unconfigured");
  });

  it("shows paused notice when registered bots have no active triggers", () => {
    const triggers = readBotTriggersFromMetadataField([{
      botPubkey: BOT_A,
      enabled: false,
      triggers: [{ kind: "keyword", enabled: true, reply: "pong", keywords: ["help"] }],
    }]);
    const summary = summarizeCommunityBotTriggerStatuses({
      botPubkeys: [BOT_A, BOT_B],
      botTriggers: triggers,
    });
    expect(summary.shouldShowPausedNotice).toBe(true);
    expect(summary.activeBotCount).toBe(0);
    expect(summary.registeredBotCount).toBe(2);
    expect(summary.unconfiguredBotCount).toBe(1);
  });

  it("pauseAllBotTriggers disables entries without deleting rules", () => {
    const triggers = readBotTriggersFromMetadataField([{
      botPubkey: BOT_A,
      enabled: true,
      triggers: [{ kind: "mention", enabled: true, reply: "hi" }],
    }]);
    const paused = pauseAllBotTriggers({ botPubkeys: [BOT_A], botTriggers: triggers });
    expect(paused).toHaveLength(1);
    expect(paused[0]?.enabled).toBe(false);
    expect(paused[0]?.triggers[0]?.enabled).toBe(false);
    expect(paused[0]?.triggers[0]?.reply).toBe("hi");
  });
});
