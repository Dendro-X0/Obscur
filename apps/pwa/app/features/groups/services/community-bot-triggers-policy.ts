import {
  filterBotTriggersToAllowlist,
  normalizeCommunityBotTriggers,
  type CommunityBotTriggerEntry,
  type CommunityBotTriggerKind,
  type CommunityBotTriggerRule,
} from "@dweb/core/community-bot-triggers-contracts";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizeCommunityBotPubkeys } from "./community-bot-policy";

export type { CommunityBotTriggerEntry, CommunityBotTriggerKind, CommunityBotTriggerRule };

/** Parse descriptor `botTriggers` field. */
export const readBotTriggersFromMetadataField = (value: unknown): ReadonlyArray<CommunityBotTriggerEntry> => (
  normalizeCommunityBotTriggers(value)
);

/** Sanitize steward edits: drop entries for unregistered bots. */
export const sanitizeBotTriggersForAllowlist = (params: Readonly<{
  botTriggers: ReadonlyArray<CommunityBotTriggerEntry>;
  botPubkeys: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<CommunityBotTriggerEntry> => (
  filterBotTriggersToAllowlist(params.botTriggers, params.botPubkeys)
);

export const findBotTriggerEntry = (
  botTriggers: ReadonlyArray<CommunityBotTriggerEntry>,
  botPubkey: string,
): CommunityBotTriggerEntry | undefined => (
  botTriggers.find((entry) => entry.botPubkey === botPubkey.trim().toLowerCase())
);

export const isBotInboundTriggersEnabled = (params: Readonly<{
  botTriggers: ReadonlyArray<CommunityBotTriggerEntry>;
  botPubkey: string;
}>): boolean => {
  const entry = findBotTriggerEntry(params.botTriggers, params.botPubkey);
  if (!entry || !entry.enabled) {
    return false;
  }
  return entry.triggers.some((rule) => rule.enabled);
};

export const countEnabledBotTriggerRules = (
  botTriggers: ReadonlyArray<CommunityBotTriggerEntry>,
): number => (
  botTriggers.reduce(
    (total, entry) => (
      entry.enabled
        ? total + entry.triggers.filter((rule) => rule.enabled).length
        : total
    ),
    0,
  )
);

export type BotInboundTriggerStatus = "active" | "paused" | "unconfigured";

/** Resolve inbound runner state for one registered bot. */
export const resolveBotInboundTriggerStatus = (params: Readonly<{
  botTriggers: ReadonlyArray<CommunityBotTriggerEntry>;
  botPubkey: string;
}>): BotInboundTriggerStatus => {
  const entry = findBotTriggerEntry(params.botTriggers, params.botPubkey);
  if (!entry) {
    return "unconfigured";
  }
  if (isBotInboundTriggersEnabled({ botTriggers: params.botTriggers, botPubkey: params.botPubkey })) {
    return "active";
  }
  return "paused";
};

export type CommunityBotTriggerSummary = Readonly<{
  registeredBotCount: number;
  activeBotCount: number;
  pausedBotCount: number;
  unconfiguredBotCount: number;
  shouldShowPausedNotice: boolean;
}>;

/** Summarize B2 trigger health for manage hub + group thread chrome. */
export const summarizeCommunityBotTriggerStatuses = (params: Readonly<{
  botPubkeys: ReadonlyArray<PublicKeyHex>;
  botTriggers: ReadonlyArray<CommunityBotTriggerEntry>;
}>): CommunityBotTriggerSummary => {
  let activeBotCount = 0;
  let pausedBotCount = 0;
  let unconfiguredBotCount = 0;

  for (const botPubkey of params.botPubkeys) {
    const status = resolveBotInboundTriggerStatus({
      botTriggers: params.botTriggers,
      botPubkey,
    });
    if (status === "active") {
      activeBotCount += 1;
    } else if (status === "paused") {
      pausedBotCount += 1;
    } else {
      unconfiguredBotCount += 1;
    }
  }

  return {
    registeredBotCount: params.botPubkeys.length,
    activeBotCount,
    pausedBotCount,
    unconfiguredBotCount,
    shouldShowPausedNotice: params.botPubkeys.length > 0 && activeBotCount === 0,
  };
};

/** Steward quick action — disable all inbound triggers without removing rules. */
export const pauseAllBotTriggers = (params: Readonly<{
  botPubkeys: ReadonlyArray<PublicKeyHex>;
  botTriggers: ReadonlyArray<CommunityBotTriggerEntry>;
}>): ReadonlyArray<CommunityBotTriggerEntry> => (
  params.botPubkeys.map((botPubkey) => {
    const entry = findBotTriggerEntry(params.botTriggers, botPubkey);
    if (!entry) {
      return {
        botPubkey,
        enabled: false,
        triggers: [],
      };
    }
    return {
      ...entry,
      enabled: false,
      triggers: entry.triggers.map((rule) => ({ ...rule, enabled: false })),
    };
  })
);

export const normalizeBotTriggersForDescriptor = (
  botTriggers: ReadonlyArray<CommunityBotTriggerEntry>,
  botPubkeys: ReadonlyArray<PublicKeyHex>,
): ReadonlyArray<CommunityBotTriggerEntry> => (
  sanitizeBotTriggersForAllowlist({
    botTriggers: normalizeCommunityBotTriggers(botTriggers),
    botPubkeys: normalizeCommunityBotPubkeys(botPubkeys),
  })
);
