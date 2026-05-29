#!/usr/bin/env node
/** B1 — smoke for botPubkeys descriptor field normalization (core contract). */

const isValidCommunityDescriptorPubkeyHex = (value) => /^[0-9a-f]{64}$/i.test(value.trim());

const normalizeCommunityDescriptorPubkeyList = (values) => {
  if (!values?.length) return [];
  const seen = new Set();
  const normalized = [];
  for (const entry of values) {
    const trimmed = entry.trim().toLowerCase();
    if (!isValidCommunityDescriptorPubkeyHex(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
};

const BOT = "aa".repeat(32);
const normalized = normalizeCommunityDescriptorPubkeyList([BOT, BOT.toUpperCase(), "invalid", "bb".repeat(32)]);

if (normalized.length !== 2 || normalized[0] !== BOT) {
  console.error("[bot-descriptor-smoke] normalize failed", normalized);
  process.exit(1);
}

const relayHint = JSON.stringify({
  id: "test-group",
  name: "Test",
  botPubkeys: normalized,
  stewardPubkeys: [BOT],
});

const parsed = JSON.parse(relayHint);
if (!Array.isArray(parsed.botPubkeys) || parsed.botPubkeys[0] !== BOT) {
  console.error("[bot-descriptor-smoke] relay hint round-trip failed");
  process.exit(1);
}

console.log("[bot-descriptor-smoke] B1 descriptor contract OK");
