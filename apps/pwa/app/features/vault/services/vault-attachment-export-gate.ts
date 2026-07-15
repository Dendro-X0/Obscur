import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { DmTrustAttachmentExportInput } from "@/app/features/dm-kernel/dm-kernel-trust-export-action-gate";
import type { VaultMediaItem } from "../types/vault-media-item";
import { extractAttachmentContentDigestFromUrl } from "@/app/features/dm-kernel/dm-kernel-trust-metadata-signals";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

export type BuildVaultAttachmentExportGateInputDeps = Readonly<{
  myPublicKeyHex: string;
  isPeerAccepted: (peerPublicKeyHex: string) => boolean;
  getPeerFirstSeenAtUnixMs: (peerPublicKeyHex: string) => number | null;
  getMessageContent?: (messageId: string) => string | undefined;
}>;

const normalizeVaultConversationId = (conversationId: string): string => {
  const trimmed = conversationId.trim();
  return trimmed.startsWith("dm:") ? trimmed.slice(3) : trimmed;
};

export const resolveDmPeerPublicKeyHexFromConversationId = (
  myPublicKeyHex: string,
  conversationId: string,
): string | null => {
  const normalizedId = normalizeVaultConversationId(conversationId);
  const parts = normalizedId.split(":");
  if (parts.length !== 2) {
    return null;
  }
  const my = normalizePublicKeyHex(myPublicKeyHex);
  const left = normalizePublicKeyHex(parts[0] ?? "");
  const right = normalizePublicKeyHex(parts[1] ?? "");
  if (!my || !left || !right) {
    return null;
  }
  if (left === my) {
    return right;
  }
  if (right === my) {
    return left;
  }
  return null;
};

export const buildVaultAttachmentExportGateInput = (
  item: VaultMediaItem,
  deps: BuildVaultAttachmentExportGateInputDeps,
): DmTrustAttachmentExportInput => {
  const fileName = item.attachment.fileName ?? "";
  const attachmentDigest = extractAttachmentContentDigestFromUrl(item.attachment.url);
  const base = {
    attachmentFileName: fileName,
    messageTimestampUnixMs: item.timestamp.getTime(),
    threadFirstPeerMessageAtUnixMs: item.timestamp.getTime(),
    profileId: getResolvedProfileId(),
    messageAttachmentContentDigests: attachmentDigest ? [attachmentDigest] : undefined,
  };

  const conversationId = item.sourceConversationId?.trim() ?? "";
  if (!conversationId || isGroupConversationId(conversationId)) {
    return {
      peerPublicKeyHex: "",
      isPeerAccepted: true,
      messageContent: "",
      peerFirstSeenAtUnixMs: null,
      ...base,
    };
  }

  const peerPublicKeyHex = resolveDmPeerPublicKeyHexFromConversationId(
    deps.myPublicKeyHex,
    conversationId,
  );
  if (!peerPublicKeyHex) {
    return {
      peerPublicKeyHex: "",
      isPeerAccepted: true,
      messageContent: deps.getMessageContent?.(item.messageId) ?? "",
      peerFirstSeenAtUnixMs: null,
      ...base,
    };
  }

  return {
    peerPublicKeyHex: peerPublicKeyHex as PublicKeyHex,
    isPeerAccepted: deps.isPeerAccepted(peerPublicKeyHex),
    messageContent: deps.getMessageContent?.(item.messageId) ?? "",
    peerFirstSeenAtUnixMs: deps.getPeerFirstSeenAtUnixMs(peerPublicKeyHex),
    ...base,
  };
};
