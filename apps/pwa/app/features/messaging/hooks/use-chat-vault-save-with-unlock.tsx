"use client";

import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit/toast";
import type { Attachment } from "../types";
import { normalizeAttachmentUrl } from "@/app/shared/public-url";
import {
  emitLesCatalogChanged,
  loadLesSavedAttachmentUrlSet,
} from "@/app/features/les/sdk/les-chat-save";
import { resolveVaultProfileId } from "@/app/features/storage/services/vault-at-rest";
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

    const multi = attachments.length > 1;
    toast.info(
      multi
        ? t("vault.saveFromChatSavingCount", {
            count: attachments.length,
            defaultValue: `Saving ${attachments.length} files to Vault…`,
          })
        : t("vault.saveFromChatSaving"),
    );

    const knownSavedUrls = await loadLesSavedAttachmentUrlSet();
    let savedCount = 0;
    let alreadyCount = 0;
    let failedCount = 0;

    for (const attachment of attachments) {
      setSavingUrl(attachment.url);
      try {
        const outcome = await saveChatAttachmentWithOutcome(attachment, t, {
          suppressUnlockToast: true,
          toastPolicy: multi ? "errors-only" : "all",
          suppressCatalogEmit: multi,
          knownSavedUrls,
        });
        if (outcome.status === "unlock_required") {
          setPendingAttachments(attachments);
          setShowUnlock(true);
          return;
        }
        if (outcome.status === "saved") {
          savedCount += 1;
          const normalized = normalizeAttachmentUrl(attachment.url) || attachment.url.trim();
          if (normalized) {
            knownSavedUrls.add(normalized);
          }
          continue;
        }
        if (outcome.reason === "already_saved") {
          alreadyCount += 1;
        } else {
          failedCount += 1;
        }
      } finally {
        setSavingUrl((current) => (current === attachment.url ? null : current));
      }
    }

    if (multi && savedCount > 0) {
      emitLesCatalogChanged(resolveVaultProfileId().trim() || undefined);
    }

    if (!multi) {
      return;
    }

    if (savedCount === 0) {
      if (alreadyCount === attachments.length) {
        toast.info(t("vault.alreadyInVault"));
      } else if (failedCount > 0 || alreadyCount > 0) {
        toast.error(t("vault.saveFromChatFailed"));
      }
      return;
    }
    if (savedCount < attachments.length) {
      toast.warning(t("vault.partialLocalSave", { saved: savedCount, total: attachments.length }));
      return;
    }
    toast.success(t("vault.saveFromChatSuccess"));
  }, [t]);

  const retryAfterUnlock = useCallback(async (): Promise<void> => {
    const pending = pendingAttachments;
    setShowUnlock(false);
    setPendingAttachments(null);
    if (!pending || pending.length === 0) {
      return;
    }
    await saveMany(pending);
  }, [pendingAttachments, saveMany]);

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
