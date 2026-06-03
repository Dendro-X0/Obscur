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

export const normalizeBotTriggersForDescriptor = (
  botTriggers: ReadonlyArray<CommunityBotTriggerEntry>,
  botPubkeys: ReadonlyArray<PublicKeyHex>,
): ReadonlyArray<CommunityBotTriggerEntry> => (
  sanitizeBotTriggersForAllowlist({
    botTriggers: normalizeCommunityBotTriggers(botTriggers),
    botPubkeys: normalizeCommunityBotPubkeys(botPubkeys),
  })
);
