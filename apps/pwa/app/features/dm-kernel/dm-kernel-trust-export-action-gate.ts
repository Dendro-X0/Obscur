import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { assessDmTrustActionGate } from "./dm-kernel-trust-action-gate";
import { isRiskyAttachmentFilename } from "./dm-kernel-trust-attachment-signals";
import type { TrustActionFrictionLevel } from "./dm-kernel-trust-assessment-port";
import { shouldTriggerAttachmentRepeatHashSignal } from "./dm-kernel-trust-metadata-signals";
import { resolveAttachmentRepeatHashDistinctPeerCount } from "./dm-kernel-trust-assess-context";

export type DmTrustAttachmentExportInput = Readonly<{
  peerPublicKeyHex: PublicKeyHex | string;
  isPeerAccepted: boolean;
  attachmentFileName: string;
  messageContent?: string;
  messageTimestampUnixMs: number;
  threadFirstPeerMessageAtUnixMs: number | null;
  peerFirstSeenAtUnixMs?: number | null;
  messageAttachmentContentDigests?: ReadonlyArray<string>;
  profileId?: string;
  attachmentRepeatHashDistinctPeerCount?: number;
  nowUnixMs?: number;
}>;

/** M4/M5 attachment export friction — structural filename + cold-peer trust shapes. */
export const resolveAttachmentExportFriction = (
  input: DmTrustAttachmentExportInput,
): TrustActionFrictionLevel => {
  if (isRiskyAttachmentFilename(input.attachmentFileName)) {
    return "confirm";
  }

  const repeatHashDistinctPeerCount = resolveAttachmentRepeatHashDistinctPeerCount(
    input.profileId,
    input.messageAttachmentContentDigests,
    input.nowUnixMs ?? Date.now(),
    input.attachmentRepeatHashDistinctPeerCount,
  ) ?? 0;

  if (shouldTriggerAttachmentRepeatHashSignal(repeatHashDistinctPeerCount)) {
    return "confirm";
  }

  if (!input.isPeerAccepted && input.peerPublicKeyHex) {
    const { friction } = assessDmTrustActionGate({
      peerPublicKeyHex: input.peerPublicKeyHex,
      isPeerAccepted: false,
      messageContent: input.messageContent ?? "",
      messageTimestampUnixMs: input.messageTimestampUnixMs,
      threadFirstPeerMessageAtUnixMs: input.threadFirstPeerMessageAtUnixMs,
      messageAttachmentFileNames: [input.attachmentFileName],
      messageAttachmentContentDigests: input.messageAttachmentContentDigests,
      profileId: input.profileId,
      attachmentRepeatHashDistinctPeerCount: repeatHashDistinctPeerCount > 0
        ? repeatHashDistinctPeerCount
        : undefined,
      peerFirstSeenAtUnixMs: input.peerFirstSeenAtUnixMs,
      nowUnixMs: input.nowUnixMs,
    });
    if (friction === "confirm" || friction === "warn") {
      return friction;
    }
  }

  return "none";
};

export const requiresAttachmentExportConfirm = (
  input: DmTrustAttachmentExportInput,
): boolean => {
  const friction = resolveAttachmentExportFriction(input);
  return friction === "confirm" || friction === "warn";
};
