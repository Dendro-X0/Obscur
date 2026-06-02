/**
 * B2 inbound bot — trigger matching, rate limits, relay subscribe helpers.
 */
import {
  buildSealedCommunityAnnouncementEvent,
  decryptGroupMessage,
  derivePublicKeyHexFromPrivate,
  publishEventToRelay,
  SEALED_COMMUNITY_KIND,
} from "./community-bot-crypto.mjs";

const DEFAULT_RATE_LIMIT_PER_MIN = 6;

export const DEFAULT_INBOUND_RATE_LIMIT_PER_MIN = DEFAULT_RATE_LIMIT_PER_MIN;

export const formatTriggerReply = (template, params) => (
  template
    .replaceAll("{{author}}", params.authorPublicKeyHex.slice(0, 8))
    .replaceAll("{{content}}", params.content)
);

export const matchKeywordTrigger = (params) => {
  const content = params.content.toLowerCase();
  return params.keywords.some((keyword) => content.includes(keyword.trim().toLowerCase()));
};

export const matchMentionTrigger = (params) => {
  const content = params.content.toLowerCase();
  const prefix = params.botPublicKeyHex.slice(0, 8).toLowerCase();
  return content.includes(`@${prefix}`) || content.includes(prefix);
};

export const findMatchingInboundTrigger = (params) => {
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
    if (rule.kind === "mention" && matchMentionTrigger({
      content: params.content,
      botPublicKeyHex: params.botPublicKeyHex,
    })) {
      return rule;
    }
  }
  return null;
};

export const createRateLimiter = (limitPerMinute = DEFAULT_RATE_LIMIT_PER_MIN) => {
  const timestamps = [];
  return {
    tryConsume(nowMs = Date.now()) {
      const windowStart = nowMs - 60_000;
      while (timestamps.length > 0 && timestamps[0] < windowStart) {
        timestamps.shift();
      }
      if (timestamps.length >= limitPerMinute) {
        return false;
      }
      timestamps.push(nowMs);
      return true;
    },
    getCount() {
      return timestamps.length;
    },
  };
};

export const parseSealedChatInner = (decryptedPayload) => {
  try {
    const parsed = JSON.parse(decryptedPayload);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (parsed.kind !== 9 || typeof parsed.content !== "string") {
      return null;
    }
    const authorPublicKeyHex = typeof parsed.pubkey === "string" ? parsed.pubkey.trim().toLowerCase() : "";
    if (!/^[0-9a-f]{64}$/.test(authorPublicKeyHex)) {
      return null;
    }
    return {
      kind: 9,
      content: parsed.content,
      authorPublicKeyHex,
      createdAtUnixSeconds: typeof parsed.created_at === "number" ? parsed.created_at : undefined,
    };
  } catch {
    return null;
  }
};

export const parseRelayMetadataBotTriggers = (content) => {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.botTriggers) ? parsed.botTriggers : [];
  } catch {
    return [];
  }
};

export const resolveBotTriggerEntry = (botTriggers, botPublicKeyHex) => {
  const normalized = botPublicKeyHex.trim().toLowerCase();
  return botTriggers.find((entry) => entry?.botPubkey?.trim?.().toLowerCase?.() === normalized) ?? null;
};

export const createProcessedEventTracker = (maxSize = 500) => {
  const seen = new Set();
  const order = [];
  return {
    has(eventId) {
      return seen.has(eventId);
    },
    add(eventId) {
      if (seen.has(eventId)) {
        return;
      }
      seen.add(eventId);
      order.push(eventId);
      if (order.length > maxSize) {
        const oldest = order.shift();
        if (oldest) {
          seen.delete(oldest);
        }
      }
    },
  };
};

export const buildInboundReplyEvent = async (params) => buildSealedCommunityAnnouncementEvent({
  privateKeyHex: params.privateKeyHex,
  groupId: params.groupId,
  roomKeyHex: params.roomKeyHex,
  content: params.content,
});

export const publishInboundReply = async (params) => {
  const event = await buildInboundReplyEvent(params);
  return publishEventToRelay({ relayUrl: params.relayUrl, event });
};

export const decryptSealedCommunityEvent = async (event, roomKeyHex) => {
  if (event.kind !== SEALED_COMMUNITY_KIND) {
    return null;
  }
  let encryptedPayload = event.content;
  try {
    encryptedPayload = JSON.parse(event.content);
  } catch {
    // content may already be ciphertext string
  }
  if (typeof encryptedPayload !== "string") {
    return null;
  }
  const decrypted = await decryptGroupMessage(encryptedPayload, roomKeyHex);
  return parseSealedChatInner(decrypted);
};

export const createScheduleRunner = (params) => {
  const timers = new Map();
  const stopAll = () => {
    for (const timer of timers.values()) {
      clearInterval(timer);
    }
    timers.clear();
  };

  const start = () => {
    stopAll();
    if (!params.entry?.enabled) {
      return;
    }
    for (const rule of params.entry.triggers) {
      if (!rule.enabled || rule.kind !== "schedule") {
        continue;
      }
      const intervalMs = Math.max(60_000, (rule.intervalMinutes ?? 60) * 60_000);
      const timer = setInterval(() => {
        void params.onTick(rule).catch(() => {});
      }, intervalMs);
      timers.set(rule, timer);
    }
  };

  return { start, stop: stopAll };
};

export const deriveBotPublicKeyHex = derivePublicKeyHexFromPrivate;

export {
  SEALED_COMMUNITY_KIND,
};
