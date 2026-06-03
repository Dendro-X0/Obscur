/**
 * B2 inbound bot trigger rules on community descriptor.
 * @see docs/messaging/community-inbound-bot.md
 */
import {
  isValidCommunityDescriptorPubkeyHex,
  normalizeCommunityDescriptorPubkeyList,
} from "./community-descriptor-contracts";

export const COMMUNITY_DESCRIPTOR_FIELD_BOT_TRIGGERS = "botTriggers" as const;

export type CommunityBotTriggerKind = "keyword" | "mention" | "schedule";

export type CommunityBotTriggerRule = Readonly<{
  kind: CommunityBotTriggerKind;
  enabled: boolean;
  /** Reply text; may include {{author}} and {{content}} placeholders. */
  reply: string;
  /** keyword: case-insensitive substring match for any listed term */
  keywords?: ReadonlyArray<string>;
  /** schedule: minimum interval between automated replies (minutes) */
  intervalMinutes?: number;
}>;

export type CommunityBotTriggerEntry = Readonly<{
  botPubkey: string;
  /** Master switch — steward can disable all triggers for this bot. */
  enabled: boolean;
  triggers: ReadonlyArray<CommunityBotTriggerRule>;
}>;

export type CommunityBotTriggers = ReadonlyArray<CommunityBotTriggerEntry>;

const TRIGGER_KINDS: ReadonlySet<string> = new Set(["keyword", "mention", "schedule"]);

const readTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeKeywords = (value: unknown): ReadonlyArray<string> => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of value) {
    const keyword = readTrimmedString(entry);
    if (!keyword) {
      continue;
    }
    const key = keyword.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(keyword);
  }
  return normalized;
};

const normalizeTriggerRule = (raw: unknown): CommunityBotTriggerRule | null => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const kind = readTrimmedString(record.kind);
  if (!kind || !TRIGGER_KINDS.has(kind)) {
    return null;
  }
  const reply = readTrimmedString(record.reply);
  if (!reply) {
    return null;
  }
  const enabled = record.enabled !== false;
  const keywords = normalizeKeywords(record.keywords);
  const intervalRaw = record.intervalMinutes;
  const intervalMinutes = typeof intervalRaw === "number" && Number.isFinite(intervalRaw)
    ? Math.max(1, Math.min(1440, Math.floor(intervalRaw)))
    : undefined;

  if (kind === "keyword" && keywords.length === 0) {
    return null;
  }
  if (kind === "schedule" && intervalMinutes === undefined) {
    return null;
  }

  return {
    kind: kind as CommunityBotTriggerKind,
    enabled,
    reply,
    ...(kind === "keyword" ? { keywords } : {}),
    ...(kind === "schedule" && intervalMinutes !== undefined ? { intervalMinutes } : {}),
  };
};

const normalizeTriggerEntry = (raw: unknown): CommunityBotTriggerEntry | null => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const botPubkey = readTrimmedString(record.botPubkey)?.toLowerCase();
  if (!botPubkey || !isValidCommunityDescriptorPubkeyHex(botPubkey)) {
    return null;
  }
  const enabled = record.enabled !== false;
  const triggersRaw = Array.isArray(record.triggers) ? record.triggers : [];
  const triggers = triggersRaw
    .map((entry) => normalizeTriggerRule(entry))
    .filter((entry): entry is CommunityBotTriggerRule => entry !== null);
  if (triggers.length === 0) {
    return null;
  }
  return { botPubkey, enabled, triggers };
};

/** Parse and normalize descriptor `botTriggers` array. Invalid entries are dropped. */
export const normalizeCommunityBotTriggers = (value: unknown): CommunityBotTriggers => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: CommunityBotTriggerEntry[] = [];
  for (const entry of value) {
    const parsed = normalizeTriggerEntry(entry);
    if (!parsed || seen.has(parsed.botPubkey)) {
      continue;
    }
    seen.add(parsed.botPubkey);
    normalized.push(parsed);
  }
  return normalized;
};

/** Keep only trigger entries whose bot pubkey is in the allowlist. */
export const filterBotTriggersToAllowlist = (
  triggers: CommunityBotTriggers,
  botPubkeys: ReadonlyArray<string> | undefined,
): CommunityBotTriggers => {
  const allowed = new Set(normalizeCommunityDescriptorPubkeyList(botPubkeys));
  if (allowed.size === 0) {
    return [];
  }
  return triggers.filter((entry) => allowed.has(entry.botPubkey));
};
