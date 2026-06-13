import {
  normalizeCommunityBotTriggers,
  type CommunityBotTriggerEntry,
} from "@dweb/core/community-bot-triggers-contracts";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { sanitizeBotTriggersForAllowlist } from "@/app/features/groups/services/community-bot-triggers-policy";

export const DEV_LAB_BOT_INBOUND_RATE_LIMIT_PER_MIN = 6;

export type DevLabInboundFloodInner = Readonly<{
  kind: 9;
  content: string;
  authorPublicKeyHex: PublicKeyHex;
}>;

export type DevLabInboundFloodEvent = Readonly<{
  eventId: string;
  inner: DevLabInboundFloodInner | null;
}>;

export type DevLabInboundFloodResult = Readonly<{
  matchedCount: number;
  publishedCount: number;
  rateLimitedCount: number;
  skippedSelfCount: number;
  duplicateCount: number;
  relayPublishAttempts: number;
}>;

const matchKeywordTrigger = (params: Readonly<{
  content: string;
  keywords: ReadonlyArray<string>;
}>): boolean => {
  const content = params.content.toLowerCase();
  return params.keywords.some((keyword) => content.includes(keyword.trim().toLowerCase()));
};

const findMatchingInboundTrigger = (params: Readonly<{
  entry: CommunityBotTriggerEntry | null | undefined;
  botPublicKeyHex: PublicKeyHex;
  content: string;
}>): CommunityBotTriggerEntry["triggers"][number] | null => {
  if (!params.entry?.enabled) {
    return null;
  }
  for (const rule of params.entry.triggers) {
    if (!rule.enabled) {
      continue;
    }
    if (rule.kind === "keyword" && matchKeywordTrigger({
      content: params.content,
      keywords: rule.keywords ?? [],
    })) {
      return rule;
    }
  }
  return null;
};

const createRateLimiter = (limitPerMinute: number) => {
  const timestamps: number[] = [];
  return {
    tryConsume(nowMs: number): boolean {
      const windowStart = nowMs - 60_000;
      while (timestamps.length > 0 && timestamps[0]! < windowStart) {
        timestamps.shift();
      }
      if (timestamps.length >= limitPerMinute) {
        return false;
      }
      timestamps.push(nowMs);
      return true;
    },
  };
};

const createProcessedEventTracker = () => {
  const seen = new Set<string>();
  return {
    has(eventId: string): boolean {
      return seen.has(eventId);
    },
    add(eventId: string): void {
      seen.add(eventId);
    },
  };
};

/** SEC-B4 / BOT-1 — deterministic keyword flood without relay I/O. Mirrors scripts/lib/community-bot-inbound.mjs. */
export const simulateDevLabInboundKeywordFlood = (params: Readonly<{
  botPublicKeyHex: PublicKeyHex;
  triggerEntry: CommunityBotTriggerEntry;
  inboundEvents: ReadonlyArray<DevLabInboundFloodEvent>;
  limitPerMinute?: number;
  nowStartMs?: number;
  intervalMs?: number;
}>): DevLabInboundFloodResult => {
  const limitPerMinute = params.limitPerMinute ?? DEV_LAB_BOT_INBOUND_RATE_LIMIT_PER_MIN;
  const rateLimiter = createRateLimiter(limitPerMinute);
  const processed = createProcessedEventTracker();
  let matchedCount = 0;
  let publishedCount = 0;
  let rateLimitedCount = 0;
  let skippedSelfCount = 0;
  let duplicateCount = 0;
  const nowStartMs = params.nowStartMs ?? 0;
  const intervalMs = params.intervalMs ?? 50;

  params.inboundEvents.forEach((event, index) => {
    const nowMs = nowStartMs + intervalMs * index;
    if (processed.has(event.eventId)) {
      duplicateCount += 1;
      return;
    }
    processed.add(event.eventId);

    const inner = event.inner;
    if (!inner) {
      return;
    }
    if (inner.authorPublicKeyHex === params.botPublicKeyHex) {
      skippedSelfCount += 1;
      return;
    }

    const rule = findMatchingInboundTrigger({
      entry: params.triggerEntry,
      botPublicKeyHex: params.botPublicKeyHex,
      content: inner.content,
    });
    if (!rule) {
      return;
    }

    matchedCount += 1;
    if (rateLimiter.tryConsume(nowMs)) {
      publishedCount += 1;
    } else {
      rateLimitedCount += 1;
    }
  });

  return {
    matchedCount,
    publishedCount,
    rateLimitedCount,
    skippedSelfCount,
    duplicateCount,
    relayPublishAttempts: publishedCount,
  };
};

export const buildDevLabKeywordFloodEvents = (
  count: number,
  authorPublicKeyHex: PublicKeyHex,
): ReadonlyArray<DevLabInboundFloodEvent> => (
  Array.from({ length: count }, (_, index) => ({
    eventId: `dev-lab-evt-${index}`,
    inner: {
      kind: 9,
      content: `please help ${index}`,
      authorPublicKeyHex,
    },
  }))
);

export const buildDevLabKeywordTriggerEntry = (
  botPublicKeyHex: PublicKeyHex,
  enabled = true,
): CommunityBotTriggerEntry => (
  normalizeCommunityBotTriggers([{
    botPubkey: botPublicKeyHex,
    enabled,
    triggers: [{
      kind: "keyword",
      enabled: true,
      reply: "pong",
      keywords: ["help"],
    }],
  }])[0]!
);

/** BOT-2 — unregistered bot triggers are dropped from descriptor edits. */
export const evaluateDevLabBotAllowlistGate = (params: Readonly<{
  registeredBotPubkeys: ReadonlyArray<PublicKeyHex>;
  triggerBotPubkey: PublicKeyHex;
}>): Readonly<{ accepted: boolean; sanitizedCount: number }> => {
  const triggers = normalizeCommunityBotTriggers([{
    botPubkey: params.triggerBotPubkey,
    enabled: true,
    triggers: [{
      kind: "keyword",
      enabled: true,
      reply: "pong",
      keywords: ["help"],
    }],
  }]);
  const sanitized = sanitizeBotTriggersForAllowlist({
    botTriggers: triggers,
    botPubkeys: params.registeredBotPubkeys,
  });
  return {
    accepted: sanitized.length > 0,
    sanitizedCount: sanitized.length,
  };
};
