import { normalizeRelayUrl } from "@dweb/nostr/relay-utils";

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const PROTOCOL_VERSION = "community-v2";
const HASHED_COMMUNITY_ID_PATTERN = /^v2_[0-9a-f]{64}$/i;

// Synchronous SHA-256 for deterministic ID derivation in both browser and test runtime.
// Adapted from a minimal public-domain implementation.
const sha256Hex = (input: string): string => {
  const rightRotate = (value: number, amount: number): number => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = "length";
  const words: number[] = [];
  const asciiBitLength = input[lengthProperty] * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }

  const utf8 = unescape(encodeURIComponent(input));
  for (let i = 0; i < utf8[lengthProperty]; i += 1) {
    const code = utf8.charCodeAt(i);
    words[i >> 2] |= code << ((3 - i) % 4) * 8;
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - asciiBitLength % 32);
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (let j = 0; j < words[lengthProperty];) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[i]
        + (w[i] = i < 16 ? w[i] : (
          w[i - 16]
          + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
          + w[i - 7]
          + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
        ) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let i = 0; i < 8; i += 1) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  let result = "";
  for (let i = 0; i < 8; i += 1) {
    for (let j = 3; j >= 0; j -= 1) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? "0" : "") + b.toString(16);
    }
  }
  return result;
};

const hashCommunityIdentity = (params: Readonly<{ genesisEventId: string; creatorPubkey: string }>): string => {
  const canonical = `${PROTOCOL_VERSION}|${params.genesisEventId.trim()}|${params.creatorPubkey.trim()}`;
  return `v2_${sha256Hex(canonical)}`;
};

// Transitional community-id derivation:
// - Keeps legacy deterministic identity (groupId + relay) to avoid hard break.
// - Accepts stronger genesis-based IDs when available.
export const deriveCommunityId = (params: Readonly<{
  existingCommunityId?: string;
  groupId: string;
  relayUrl?: string;
  genesisEventId?: string;
  creatorPubkey?: string;
}>): string => {
  if (isNonEmptyString(params.existingCommunityId)) {
    return params.existingCommunityId.trim();
  }
  if (isNonEmptyString(params.genesisEventId) && isNonEmptyString(params.creatorPubkey)) {
    return hashCommunityIdentity({
      genesisEventId: params.genesisEventId,
      creatorPubkey: params.creatorPubkey
    });
  }
  const relayUrl = normalizeRelayUrl(params.relayUrl);
  return `${params.groupId}:${relayUrl}`;
};

export const isHashedCommunityId = (communityId: string | null | undefined): boolean => {
  const trimmed = communityId?.trim() ?? "";
  return HASHED_COMMUNITY_ID_PATTERN.test(trimmed);
};

export const pickPreferredCommunityId = (
  primaryCommunityId: string | null | undefined,
  secondaryCommunityId: string | null | undefined,
): string | undefined => {
  const primary = primaryCommunityId?.trim() ?? "";
  const secondary = secondaryCommunityId?.trim() ?? "";
  if (isHashedCommunityId(primary) && !isHashedCommunityId(secondary)) {
    return primary;
  }
  if (isHashedCommunityId(secondary) && !isHashedCommunityId(primary)) {
    return secondary;
  }
  return primary || secondary || undefined;
};

export const toCommunityConversationId = (communityId: string): string => {
  return `community:${communityId}`;
};
