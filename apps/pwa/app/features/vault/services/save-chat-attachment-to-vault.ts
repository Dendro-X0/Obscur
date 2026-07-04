"use client";

import { toast } from "@dweb/ui-kit";
import type { Attachment } from "@/app/features/messaging/types";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { persistAttachmentToLocalVault, resolveLocalMediaUrl } from "./local-media-store";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export const canSaveChatAttachmentsToLocalVault = (): boolean => hasNativeRuntime();

export const isChatAttachmentSavedToLocalVault = async (remoteUrl: string): Promise<boolean> => {
    if (!hasNativeRuntime()) {
        return false;
    }
    return Boolean(await resolveLocalMediaUrl(remoteUrl.trim()));
};

export const saveChatAttachmentToLocalVault = async (
    attachment: Attachment,
    t: TranslateFn,
): Promise<boolean> => {
    if (!hasNativeRuntime()) {
        toast.error(t("vault.saveFromChatUnavailable"));
        return false;
    }
    const localUrl = await persistAttachmentToLocalVault(attachment);
    if (!localUrl) {
        toast.error(t("vault.saveFromChatFailed"));
        return false;
    }
    toast.success(t("vault.saveFromChatSuccess"));
    return true;
};

export const saveChatAttachmentsToLocalVault = async (
    attachments: ReadonlyArray<Attachment>,
    t: TranslateFn,
): Promise<number> => {
    if (!hasNativeRuntime() || attachments.length === 0) {
        return 0;
    }
    let savedCount = 0;
    for (const attachment of attachments) {
        const localUrl = await persistAttachmentToLocalVault(attachment);
        if (localUrl) {
            savedCount += 1;
        }
    }
    if (savedCount === 0) {
        toast.error(t("vault.saveFromChatFailed"));
    } else if (savedCount < attachments.length) {
        toast.warning(t("vault.partialLocalSave", { saved: savedCount, total: attachments.length }));
    } else {
        toast.success(t("vault.saveFromChatSuccess"));
    }
    return savedCount;
};
