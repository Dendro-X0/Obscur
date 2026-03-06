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
