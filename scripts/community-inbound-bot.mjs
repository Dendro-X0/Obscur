#!/usr/bin/env node
/**
 * B2 — inbound community bot runner (keyword / mention / schedule triggers).
 *
 * @example
 * OBSCUR_BOT_NSEC=nsec1… \
 * OBSCUR_BOT_RELAY_URL=ws://127.0.0.1:7000 \
 * OBSCUR_BOT_GROUP_ID=<group-id> \
 * OBSCUR_BOT_ROOM_KEY_HEX=<64-hex> \
 * OBSCUR_BOT_ALLOWED_PUBKEYS=<bot-pubkey-hex> \
 * node scripts/community-inbound-bot.mjs
 */
import { normalizeCommunityBotTriggers } from "./lib/community-bot-triggers-contracts.mjs";
import {
  assertBotPubkeyAllowlisted,
  decodePrivateKeyInput,
  derivePublicKeyHexFromPrivate,
} from "./lib/community-bot-crypto.mjs";
import {
  createProcessedEventTracker,
  createRateLimiter,
  createScheduleRunner,
  decryptSealedCommunityEvent,
  DEFAULT_INBOUND_RATE_LIMIT_PER_MIN,
  findMatchingInboundTrigger,
  formatTriggerReply,
  parseRelayMetadataBotTriggers,
  publishInboundReply,
  resolveBotTriggerEntry,
  SEALED_COMMUNITY_KIND,
} from "./lib/community-bot-inbound.mjs";

const parseArgs = (argv) => {
  const flags = new Set();
  for (const arg of argv) {
    if (arg === "--once") {
      flags.add("once");
    }
  }
  return { flags };
};

const readEnv = (key, fallback = "") => (process.env[key] ?? fallback).trim();

const readRateLimit = () => {
  const raw = readEnv("OBSCUR_BOT_RATE_LIMIT_PER_MIN");
  if (!raw) {
    return DEFAULT_INBOUND_RATE_LIMIT_PER_MIN;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_INBOUND_RATE_LIMIT_PER_MIN;
  }
  return Math.min(parsed, 60);
};

const readTriggerConfig = () => {
  const json = readEnv("OBSCUR_BOT_INBOUND_TRIGGERS_JSON");
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json);
    return normalizeCommunityBotTriggers(Array.isArray(parsed) ? parsed : [parsed]);
  } catch (error) {
    throw new Error(`Invalid OBSCUR_BOT_INBOUND_TRIGGERS_JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const fetchRelayMetadataTriggers = async ({ relayUrl, groupId, timeoutMs = 12_000 }) => new Promise((resolve) => {
  const ws = new WebSocket(relayUrl);
  const subId = `bot-triggers-${Date.now()}`;
  let settled = false;

  const finish = (value) => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timer);
    try { ws.close(); } catch { /* ignore */ }
    resolve(value);
  };

  const timer = setTimeout(() => finish([]), timeoutMs);

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify(["REQ", subId, { kinds: [39000], "#h": [groupId], limit: 1 }]));
  }, { once: true });

  ws.addEventListener("message", (messageEvent) => {
    if (typeof messageEvent.data !== "string") {
      return;
    }
    try {
      const parsed = JSON.parse(messageEvent.data);
      if (!Array.isArray(parsed)) {
        return;
      }
      if (parsed[0] === "EVENT" && parsed[2]?.kind === 39000) {
        finish(parseRelayMetadataBotTriggers(parsed[2].content));
      }
      if (parsed[0] === "EOSE") {
        finish([]);
      }
    } catch {
      // ignore malformed frames
    }
  });

  ws.addEventListener("error", () => finish([]), { once: true });
});

const main = async () => {
  const { flags } = parseArgs(process.argv.slice(2));
  const runOnce = flags.has("once");

  const nsecOrHex = readEnv("OBSCUR_BOT_NSEC");
  const relayUrl = readEnv("OBSCUR_BOT_RELAY_URL");
  const groupId = readEnv("OBSCUR_BOT_GROUP_ID");
  const roomKeyHex = readEnv("OBSCUR_BOT_ROOM_KEY_HEX");
  const allowedRaw = readEnv("OBSCUR_BOT_ALLOWED_PUBKEYS");

  if (!nsecOrHex || !relayUrl || !groupId || !roomKeyHex) {
    console.error(`[community-inbound-bot] Missing required env.
  OBSCUR_BOT_NSEC
  OBSCUR_BOT_RELAY_URL
  OBSCUR_BOT_GROUP_ID
  OBSCUR_BOT_ROOM_KEY_HEX
  OBSCUR_BOT_ALLOWED_PUBKEYS (recommended)
  OBSCUR_BOT_INBOUND_TRIGGERS_JSON (optional — else fetch kind 39000)
  OBSCUR_BOT_RATE_LIMIT_PER_MIN (default 6)
`);
    process.exit(1);
  }

  const privateKeyHex = decodePrivateKeyInput(nsecOrHex);
  if (!privateKeyHex) {
    console.error("[community-inbound-bot] Invalid OBSCUR_BOT_NSEC");
    process.exit(1);
  }

  const allowedBotPubkeys = allowedRaw.split(/[,\s]+/).filter(Boolean);
  assertBotPubkeyAllowlisted({ privateKeyHex, allowedBotPubkeys });
  const botPublicKeyHex = derivePublicKeyHexFromPrivate(privateKeyHex);

  let botTriggers = readTriggerConfig();
  if (botTriggers.length === 0) {
    botTriggers = normalizeCommunityBotTriggers(await fetchRelayMetadataTriggers({ relayUrl, groupId }));
  }
  const triggerEntry = resolveBotTriggerEntry(botTriggers, botPublicKeyHex);
  if (!triggerEntry) {
    console.error("[community-inbound-bot] No botTriggers entry for this bot pubkey — configure in Manage → General → Inbound triggers");
    process.exit(1);
  }

  const rateLimiter = createRateLimiter(readRateLimit());
  const processed = createProcessedEventTracker();

  const sendReply = async (rule, inner) => {
    if (!rateLimiter.tryConsume()) {
      console.log("[community-inbound-bot] rate limit reached — skipping reply");
      return;
    }
    const replyText = formatTriggerReply(rule.reply, {
      authorPublicKeyHex: inner?.authorPublicKeyHex ?? "unknown",
      content: inner?.content ?? "",
    });
    const result = await publishInboundReply({
      privateKeyHex,
      groupId,
      roomKeyHex,
      relayUrl,
      content: replyText,
    });
    console.log("[community-inbound-bot] replied:", result.message ?? "ok");
  };

  const scheduleRunner = createScheduleRunner({
    entry: triggerEntry,
    onTick: async (rule) => {
      if (!rateLimiter.tryConsume()) {
        console.log("[community-inbound-bot] schedule tick skipped (rate limit)");
        return;
      }
      await sendReply(rule, { authorPublicKeyHex: botPublicKeyHex, content: "" });
    },
  });

  if (!runOnce) {
    scheduleRunner.start();
  }

  console.log("[community-inbound-bot] bot pubkey", botPublicKeyHex);
  console.log("[community-inbound-bot] group", groupId);
  console.log("[community-inbound-bot] relay", relayUrl);
  console.log("[community-inbound-bot] triggers enabled", triggerEntry.enabled);
  console.log("[community-inbound-bot] active rules", triggerEntry.triggers.filter((rule) => rule.enabled).length);

  if (runOnce) {
    console.log("[community-inbound-bot] --once mode — validated config, exiting");
    return;
  }

  const ws = new WebSocket(relayUrl);
  const subId = `bot-inbound-${Date.now()}`;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket open timeout")), 12_000);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("WebSocket connection failed"));
    }, { once: true });
  });

  ws.send(JSON.stringify(["REQ", subId, { kinds: [SEALED_COMMUNITY_KIND], "#h": [groupId] }]));
  console.log("[community-inbound-bot] subscribed — waiting for messages");

  ws.addEventListener("message", (messageEvent) => {
    if (typeof messageEvent.data !== "string") {
      return;
    }
    void (async () => {
      try {
        const parsed = JSON.parse(messageEvent.data);
        if (!Array.isArray(parsed) || parsed[0] !== "EVENT" || !parsed[2]) {
          return;
        }
        const event = parsed[2];
        if (event.kind !== SEALED_COMMUNITY_KIND || processed.has(event.id)) {
          return;
        }
        processed.add(event.id);

        const inner = await decryptSealedCommunityEvent(event, roomKeyHex);
        if (!inner || inner.authorPublicKeyHex === botPublicKeyHex) {
          return;
        }

        const rule = findMatchingInboundTrigger({
          entry: triggerEntry,
          botPublicKeyHex,
          content: inner.content,
        });
        if (!rule) {
          return;
        }

        await sendReply(rule, inner);
      } catch (error) {
        console.error(
          "[community-inbound-bot] event handling failed:",
          error instanceof Error ? error.message : String(error),
        );
      }
    })();
  });

  const shutdown = () => {
    scheduleRunner.stop();
    try { ws.close(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

main().catch((error) => {
  console.error(
    "[community-inbound-bot] failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
