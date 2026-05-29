import {
  isValidCommunityDescriptorPubkeyHex,
  normalizeCommunityDescriptorPubkeyList,
} from "@dweb/core/community-descriptor-contracts";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/** Dedupe and validate bot pubkeys from descriptor metadata. */
export const readBotPubkeysFromMetadataField = (
  value: unknown,
): ReadonlyArray<PublicKeyHex> => (
  Array.isArray(value)
    ? normalizeCommunityBotPubkeys(value.filter((entry): entry is string => typeof entry === "string"))
    : []
);

export const normalizeCommunityBotPubkeys = (
  pubkeys: ReadonlyArray<string> | undefined,
): ReadonlyArray<PublicKeyHex> => (
  normalizeCommunityDescriptorPubkeyList(pubkeys) as ReadonlyArray<PublicKeyHex>
);

export const isRegisteredCommunityBot = (params: Readonly<{
  botPubkeys: ReadonlyArray<PublicKeyHex>;
  authorPublicKeyHex: string | null;
}>): boolean => {
  const author = params.authorPublicKeyHex?.trim().toLowerCase();
  if (!author || !isValidCommunityDescriptorPubkeyHex(author)) {
    return false;
  }
  return params.botPubkeys.some((pubkey) => pubkey.toLowerCase() === author);
};

export const parseCommunityBotPubkeyInput = (raw: string): PublicKeyHex | null => {
  const trimmed = raw.trim().toLowerCase();
  return isValidCommunityDescriptorPubkeyHex(trimmed) ? (trimmed as PublicKeyHex) : null;
};
