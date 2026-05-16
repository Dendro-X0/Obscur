import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { toDmConversationId } from "./dm-conversation-id";

/** Infer the DM peer pubkey from a conversation id (legacy peer id, `a:b`, or canonical sorted id). */
export const inferPeerFromConversationId = (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): PublicKeyHex | null => {
  if (isGroupConversationId(params.conversationId)) {
    return null;
  }
  const directPeer = normalizePublicKeyHex(params.conversationId.trim());
  if (directPeer && directPeer !== params.myPublicKeyHex) {
    return directPeer;
  }

  const parts = params.conversationId.split(":");
  if (parts.length !== 2) {
    return null;
  }
  const left = normalizePublicKeyHex(parts[0]);
  const right = normalizePublicKeyHex(parts[1]);
  if (!left || !right) {
    return null;
  }
  if (left === params.myPublicKeyHex && right !== params.myPublicKeyHex) {
    return right;
  }
  if (right === params.myPublicKeyHex && left !== params.myPublicKeyHex) {
    return left;
  }
  return null;
};

/** All local IndexedDB conversation id aliases for the same DM thread (canonical + legacy orderings). */
export const buildDmSiblingConversationIds = (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): ReadonlyArray<string> => {
  if (isGroupConversationId(params.conversationId)) {
    return [params.conversationId.trim()].filter((id) => id.length > 0);
  }
  const candidateIds = new Set<string>();
  candidateIds.add(params.conversationId);
  const inferredPeer = inferPeerFromConversationId(params);
  if (!inferredPeer) {
    return Array.from(candidateIds);
  }
  candidateIds.add(inferredPeer);
  candidateIds.add(`${params.myPublicKeyHex}:${inferredPeer}`);
  candidateIds.add(`${inferredPeer}:${params.myPublicKeyHex}`);
  const canonicalConversationId = toDmConversationId({
    myPublicKeyHex: params.myPublicKeyHex,
    peerPublicKeyHex: inferredPeer,
  });
  if (canonicalConversationId) {
    candidateIds.add(canonicalConversationId);
  }
  return Array.from(candidateIds);
};
