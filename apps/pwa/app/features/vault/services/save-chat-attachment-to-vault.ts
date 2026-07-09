"use client";

import { toast } from "@dweb/ui-kit";
import type { Attachment } from "@/app/features/messaging/types";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
    saveFileToLocalVault,
    classifyAttachmentFetchUrlForVaultSave,
    isLocalVaultOnlyUrl,
    persistAttachmentToLocalVault,
    resolveLocalMediaUrl,
} from "./local-media-store";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Save-from-chat is disabled until the chat→vault pipeline is proven end-to-end.
 * Vault intake remains: Secure Upload (Vault page) and Download to disk.
 */
export const VAULT_SAVE_FROM_CHAT_ENABLED = false;

export const canSaveChatAttachmentsToLocalVault = (): boolean =>
    VAULT_SAVE_FROM_CHAT_ENABLED && hasNativeRuntime();

const trySaveAsVaultNativeCopy = async (attachment: Attachment): Promise<boolean> => {
    const url = attachment.url.trim();
    if (!url) {
        return false;
    }
    try {
        const response = await fetch(url, { method: "GET", credentials: "include" });
        if (!response.ok) {
            return false;
        }
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength === 0) {
            return false;
        }
        const fileName = attachment.fileName?.trim() || "attachment";
        const contentType = attachment.contentType?.trim() || "application/octet-stream";
        const file = new File([bytes], fileName, { type: contentType });
        const saved = await saveFileToLocalVault(file);
        return Boolean(saved?.localUrl);
    } catch {
        return false;
    }
};

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
    if (isLocalVaultOnlyUrl(attachment.url)) {
        toast.info(t("vault.saveFromChatLocalVaultOnly"));
        return false;
    }
    const urlClass = classifyAttachmentFetchUrlForVaultSave(attachment.url);
    if (urlClass === "blocked_host") {
        toast.error(t("vault.saveFromChatBlockedHost"));
        return false;
    }
    // Radical strategy: always try creating a vault-native copy first.
    // This bypasses remote-url index coupling and guarantees a new vault row when bytes are readable.
    const nativeCopySaved = await trySaveAsVaultNativeCopy(attachment);
    if (nativeCopySaved) {
        toast.success(t("vault.saveFromChatSuccess"));
        return true;
    }

    const localUrl = urlClass === "unsupported"
        ? null
        : await persistAttachmentToLocalVault(attachment);
    if (localUrl) {
        toast.success(t("vault.saveFromChatSuccess"));
        return true;
    }
    if (urlClass === "unsupported") {
        toast.error(t("vault.saveFromChatUnsupportedUrl"));
        return false;
    }
    toast.error(t("vault.saveFromChatFailed"));
    return false;
};

export const saveChatAttachmentsToLocalVault = async (
    attachments: ReadonlyArray<Attachment>,
    t: TranslateFn,
): Promise<number> => {
    if (!VAULT_SAVE_FROM_CHAT_ENABLED || !hasNativeRuntime() || attachments.length === 0) {
        return 0;
    }
    let savedCount = 0;
    for (const attachment of attachments) {
        const nativeCopySaved = await trySaveAsVaultNativeCopy(attachment);
        if (nativeCopySaved) {
            savedCount += 1;
            continue;
        }
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
