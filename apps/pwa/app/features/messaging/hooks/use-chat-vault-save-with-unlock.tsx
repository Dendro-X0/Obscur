"use client";

import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Attachment } from "../types";
import {
  saveChatAttachmentWithOutcome,
  type SaveChatAttachmentOutcome,
} from "@/app/features/vault/services/save-chat-attachment-to-vault";
import { VaultWriteUnlockDialog } from "@/app/features/security/components/vault-write-unlock-dialog";

/**
 * Chat → Vault save that opens VaultWriteUnlockDialog on unlock_required
 * instead of the confusing red toast alone.
 */
export function useChatVaultSaveWithUnlock(): Readonly<{
  saveOne: (attachment: Attachment) => Promise<SaveChatAttachmentOutcome>;
  saveMany: (attachments: ReadonlyArray<Attachment>) => Promise<void>;
  isSavingUrl: (url: string) => boolean;
  unlockDialog: React.ReactNode;
}> {
  const { t } = useTranslation();
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ReadonlyArray<Attachment> | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);

  const saveOne = useCallback(async (attachment: Attachment): Promise<SaveChatAttachmentOutcome> => {
    setSavingUrl(attachment.url);
    try {
      const outcome = await saveChatAttachmentWithOutcome(attachment, t, {
        suppressUnlockToast: true,
      });
      if (outcome.status === "unlock_required") {
        setPendingAttachments([attachment]);
        setShowUnlock(true);
      }
      return outcome;
    } finally {
      setSavingUrl((current) => (current === attachment.url ? null : current));
    }
  }, [t]);

  const saveMany = useCallback(async (attachments: ReadonlyArray<Attachment>): Promise<void> => {
    if (attachments.length === 0) {
      return;
    }
    for (const attachment of attachments) {
      setSavingUrl(attachment.url);
      try {
        const outcome = await saveChatAttachmentWithOutcome(attachment, t, {
          suppressUnlockToast: true,
          toastPolicy: attachments.length > 1 ? "errors-only" : "all",
        });
        if (outcome.status === "unlock_required") {
          setPendingAttachments(attachments);
          setShowUnlock(true);
          return;
        }
      } finally {
        setSavingUrl((current) => (current === attachment.url ? null : current));
      }
    }
  }, [t]);

  const retryAfterUnlock = useCallback(async (): Promise<void> => {
    const pending = pendingAttachments;
    setShowUnlock(false);
    setPendingAttachments(null);
    if (!pending || pending.length === 0) {
      return;
    }
    for (const attachment of pending) {
      setSavingUrl(attachment.url);
      try {
        await saveChatAttachmentWithOutcome(attachment, t);
      } finally {
        setSavingUrl((current) => (current === attachment.url ? null : current));
      }
    }
  }, [pendingAttachments, t]);

  const unlockDialog = (
    <VaultWriteUnlockDialog
      isOpen={showUnlock}
      onClose={() => {
        setShowUnlock(false);
        setPendingAttachments(null);
      }}
      onUnlocked={() => {
        void retryAfterUnlock();
      }}
    />
  );

  return {
    saveOne,
    saveMany,
    isSavingUrl: (url: string) => savingUrl === url,
    unlockDialog,
  };
}
