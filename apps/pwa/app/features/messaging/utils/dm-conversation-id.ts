import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";

export const toDmConversationId = (params: Readonly<{
  myPublicKeyHex: string;
  peerPublicKeyHex: string;
}>): string | null => {
  const my = normalizePublicKeyHex(params.myPublicKeyHex);
  const peer = normalizePublicKeyHex(params.peerPublicKeyHex);
  if (!my || !peer) return null;
  return [my, peer].sort().join(":");
};

export const toDmConversationIdUnsafe = (params: Readonly<{
  myPublicKeyHex: PublicKeyHex;
  peerPublicKeyHex: PublicKeyHex;
}>): string => {
  return [params.myPublicKeyHex, params.peerPublicKeyHex].sort().join(":");
};

/** For self-authored events, the counterparty is the `#p` tag recipient, not `event.pubkey`. */
export const resolveDmCounterpartyPubkey = (params: Readonly<{
  myPublicKeyHex: string;
  senderPubkey: string;
  tags?: ReadonlyArray<ReadonlyArray<string>>;
}>): string => {
  const my = params.myPublicKeyHex.trim().toLowerCase();
  const sender = params.senderPubkey.trim();
  if (sender.toLowerCase() !== my) {
    return sender;
  }
  const pTag = params.tags?.find((tag) => tag[0] === "p" && typeof tag[1] === "string")?.[1]?.trim();
  if (pTag && pTag.length > 0 && pTag.toLowerCase() !== my) {
    return pTag;
  }
  return sender;
};

export const toDmConversationIdFromEvent = (params: Readonly<{
  myPublicKeyHex: string;
  senderPubkey: string;
  tags?: ReadonlyArray<ReadonlyArray<string>>;
}>): string | null => {
  const peer = resolveDmCounterpartyPubkey(params);
  return toDmConversationId({ myPublicKeyHex: params.myPublicKeyHex, peerPublicKeyHex: peer });
};

/** True when two conversation id strings refer to the same DM thread (normalized pubkey pair). */
export const dmConversationIdsMatch = (
  a: string,
  b: string,
  myPublicKeyHex: string,
  peerPublicKeyHex: string,
): boolean => {
  if (a === b) {
    return true;
  }
  const canonical = toDmConversationId({ myPublicKeyHex, peerPublicKeyHex });
  if (!canonical) {
    return false;
  }
  const knownThreadIds = new Set<string>([canonical]);
  const myVariants = [myPublicKeyHex, myPublicKeyHex.toUpperCase()];
  const peerVariants = [peerPublicKeyHex, peerPublicKeyHex.toUpperCase()];
  for (const myVariant of myVariants) {
    for (const peerVariant of peerVariants) {
      knownThreadIds.add([myVariant, peerVariant].sort().join(":"));
    }
  }
  return knownThreadIds.has(a) && knownThreadIds.has(b);
};
