/**
 * Community descriptor fields carried in sealed updates and kind 39000 hints.
 * @see docs/messaging/community-outbound-bot.md
 */

export const COMMUNITY_DESCRIPTOR_FIELD_BOT_PUBKEYS = "botPubkeys" as const;
export const COMMUNITY_DESCRIPTOR_FIELD_STEWARD_PUBKEYS = "stewardPubkeys" as const;

export type CommunityDescriptorPubkeyHex = string;

/** 64-char hex secp256k1 pubkey (lowercase normalized on ingest in PWA). */
export const isValidCommunityDescriptorPubkeyHex = (value: string): boolean => (
  /^[0-9a-f]{64}$/i.test(value.trim())
);

export const normalizeCommunityDescriptorPubkeyList = (
  values: ReadonlyArray<string> | undefined,
): ReadonlyArray<CommunityDescriptorPubkeyHex> => {
  if (!values?.length) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: CommunityDescriptorPubkeyHex[] = [];
  for (const entry of values) {
    const trimmed = entry.trim().toLowerCase();
    if (!isValidCommunityDescriptorPubkeyHex(trimmed) || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
};

export type CommunityDescriptorRelayHintPayload = Readonly<{
  id: string;
  name: string;
  about?: string;
  picture?: string;
  access?: string;
  communityMode?: string;
  relayCapabilityTier?: string;
  descriptorVersion?: number;
  stewardPubkeys?: ReadonlyArray<CommunityDescriptorPubkeyHex>;
  botPubkeys?: ReadonlyArray<CommunityDescriptorPubkeyHex>;
  botTriggers?: ReadonlyArray<Readonly<{
    botPubkey: CommunityDescriptorPubkeyHex;
    enabled: boolean;
    triggers: ReadonlyArray<Readonly<{
      kind: string;
      enabled: boolean;
      reply: string;
      keywords?: ReadonlyArray<string>;
      intervalMinutes?: number;
    }>>;
  }>>;
}>;
