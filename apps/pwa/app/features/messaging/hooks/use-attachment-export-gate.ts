"use client";

import { useCallback, useRef, useState } from "react";
import type { MediaItem } from "@/app/features/messaging/types";
import {
  requiresAttachmentExportConfirm,
  type DmTrustAttachmentExportInput,
} from "@/app/features/dm-kernel/dm-kernel-trust-export-action-gate";
import { extractAttachmentContentDigestFromUrl } from "@/app/features/dm-kernel/dm-kernel-trust-metadata-signals";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  type MediaPreviewTrustExportContext,
  useMediaPreviewScope,
} from "@/app/features/messaging/services/media-preview-scope";

const buildExportGateInput = (
  item: MediaItem,
  trustExportContext: MediaPreviewTrustExportContext | null | undefined,
): DmTrustAttachmentExportInput => {
  const fileName = item.attachment.fileName ?? "";
  const attachmentDigest = extractAttachmentContentDigestFromUrl(item.attachment.url);
  const digestFields = {
    profileId: getResolvedProfileId(),
    messageAttachmentContentDigests: attachmentDigest ? [attachmentDigest] : undefined,
  };
  if (!trustExportContext) {
    return {
      peerPublicKeyHex: "",
      isPeerAccepted: true,
      attachmentFileName: fileName,
      messageTimestampUnixMs: item.timestamp.getTime(),
      threadFirstPeerMessageAtUnixMs: null,
      ...digestFields,
    };
  }
  return {
    peerPublicKeyHex: trustExportContext.peerPublicKeyHex,
    isPeerAccepted: trustExportContext.isPeerAccepted,
    attachmentFileName: fileName,
    messageContent: trustExportContext.messageContentByMessageId[item.messageId] ?? "",
    messageTimestampUnixMs: item.timestamp.getTime(),
    threadFirstPeerMessageAtUnixMs: trustExportContext.threadFirstPeerMessageAtUnixMs,
    peerFirstSeenAtUnixMs: trustExportContext.peerFirstSeenAtUnixMs,
    ...digestFields,
  };
};

export type UseAttachmentExportGateResult = Readonly<{
  pendingExportFileName: string | null;
  cancelExportConfirm: () => void;
  confirmExport: () => Promise<void>;
  runExportWithGate: (item: MediaItem, runExport: () => Promise<void>) => Promise<void>;
}>;

export const useAttachmentExportGate = (): UseAttachmentExportGateResult => {
  const { trustExportContext } = useMediaPreviewScope();
  const [pendingExportFileName, setPendingExportFileName] = useState<string | null>(null);
  const pendingExportRunnerRef = useRef<(() => Promise<void>) | null>(null);

  const cancelExportConfirm = useCallback((): void => {
    pendingExportRunnerRef.current = null;
    setPendingExportFileName(null);
  }, []);

  const confirmExport = useCallback(async (): Promise<void> => {
    const runner = pendingExportRunnerRef.current;
    pendingExportRunnerRef.current = null;
    setPendingExportFileName(null);
    if (runner) {
      await runner();
    }
  }, []);

  const runExportWithGate = useCallback(async (
    item: MediaItem,
    runExport: () => Promise<void>,
  ): Promise<void> => {
    const input = buildExportGateInput(item, trustExportContext);
    if (requiresAttachmentExportConfirm(input)) {
      pendingExportRunnerRef.current = runExport;
      setPendingExportFileName(item.attachment.fileName ?? "attachment");
      return;
    }
    await runExport();
  }, [trustExportContext]);

  return {
    pendingExportFileName,
    cancelExportConfirm,
    confirmExport,
    runExportWithGate,
  };
};
