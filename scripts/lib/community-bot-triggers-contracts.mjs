/**
 * Node mirror of @dweb/core/community-bot-triggers-contracts (B2 descriptor field).
 */

const isValidPubkey = (value) => /^[0-9a-f]{64}$/i.test(value.trim());

const readTrimmedString = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeKeywords = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const normalized = [];
  for (const entry of value) {
    const keyword = readTrimmedString(entry);
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(keyword);
  }
  return normalized;
};

const normalizeTriggerRule = (raw) => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const kind = readTrimmedString(raw.kind);
  if (!kind || !["keyword", "mention", "schedule"].includes(kind)) return null;
  const reply = readTrimmedString(raw.reply);
  if (!reply) return null;
  const enabled = raw.enabled !== false;
  const keywords = normalizeKeywords(raw.keywords);
  const intervalRaw = raw.intervalMinutes;
  const intervalMinutes = typeof intervalRaw === "number" && Number.isFinite(intervalRaw)
    ? Math.max(1, Math.min(1440, Math.floor(intervalRaw)))
    : undefined;
  if (kind === "keyword" && keywords.length === 0) return null;
  if (kind === "schedule" && intervalMinutes === undefined) return null;
  return {
    kind,
    enabled,
    reply,
    ...(kind === "keyword" ? { keywords } : {}),
    ...(kind === "schedule" ? { intervalMinutes } : {}),
  };
};

const normalizeTriggerEntry = (raw) => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const botPubkey = readTrimmedString(raw.botPubkey)?.toLowerCase();
  if (!botPubkey || !isValidPubkey(botPubkey)) return null;
  const enabled = raw.enabled !== false;
  const triggersRaw = Array.isArray(raw.triggers) ? raw.triggers : [];
  const triggers = triggersRaw
    .map((entry) => normalizeTriggerRule(entry))
    .filter(Boolean);
  if (triggers.length === 0) return null;
  return { botPubkey, enabled, triggers };
};

export const normalizeCommunityBotTriggers = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const normalized = [];
  for (const entry of value) {
    const parsed = normalizeTriggerEntry(entry);
    if (!parsed || seen.has(parsed.botPubkey)) continue;
    seen.add(parsed.botPubkey);
    normalized.push(parsed);
  }
  return normalized;
};
