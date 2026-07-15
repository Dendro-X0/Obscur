"use client";

import { toast } from "@dweb/ui-kit";
import type { Attachment } from "@/app/features/messaging/types";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { VaultWriteEncryptionRequiredError } from "@/app/features/storage/services/vault-at-rest";
import { normalizeAttachmentUrl } from "@/app/shared/public-url";
import {
    saveFileToLocalVault,
    classifyAttachmentFetchUrlForVaultSave,
    isLocalVaultOnlyUrl,
    persistAttachmentToLocalVault,
    resolveLocalMediaUrl,
    fetchRemoteAttachmentBytesForVaultSave,
    awaitVaultIndexRowForKey,
    isVaultEncryptionSessionReady,
    hydrateVaultDiskInventoryForActiveProfile,
} from "./local-media-store";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Maintainer release flag — flip to `true` after G8 sandbox sign-off + L3 chain proof.
 * Desktop shell builds enable chat→vault intake via `isVaultSaveFromChatFeatureEnabled`.
 */
export const VAULT_SAVE_FROM_CHAT_ENABLED = false;

const parseEnvFlag = (value: string | undefined): boolean => (value ?? "").trim() === "1";

/** True when chat→vault save UI and intake should be available. */
export const isVaultSaveFromChatFeatureEnabled = (): boolean => {
    if (VAULT_SAVE_FROM_CHAT_ENABLED) {
        return true;
    }
    if (parseEnvFlag(process.env.NEXT_PUBLIC_OBSCUR_VAULT_SAVE_FROM_CHAT)) {
        return true;
    }
    return process.env.NEXT_PUBLIC_DESKTOP_SHELL === "1";
};

export const canSaveChatAttachmentsToLocalVault = (): boolean =>
    isVaultSaveFromChatFeatureEnabled() && hasNativeRuntime();

export type SaveChatAttachmentOutcome =
    | Readonly<{ status: "saved" }>
    | Readonly<{ status: "unlock_required" }>
    | Readonly<{ status: "failed"; reason: string }>;

const isReadableLocalPreviewUrl = (url: string): boolean => {
    const trimmed = url.trim().toLowerCase();
    return (
        trimmed.startsWith("blob:")
        || trimmed.startsWith("asset:")
        || trimmed.startsWith("file:")
        || trimmed.includes("asset.localhost")
        || trimmed.includes("ipc.localhost")
    );
};

const fetchPreviewBytes = async (url: string): Promise<Uint8Array | null> => {
    if (!isReadableLocalPreviewUrl(url)) {
        return null;
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return null;
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        return bytes.byteLength > 0 ? bytes : null;
    } catch {
        return null;
    }
};

const resolveAttachmentBytesForVaultSave = async (
    attachment: Attachment,
): Promise<Uint8Array | null> => {
    const url = attachment.url.trim();
    if (!url) {
        return null;
    }
    const previewBytes = await fetchPreviewBytes(url);
    if (previewBytes) {
        return previewBytes;
    }
    return fetchRemoteAttachmentBytesForVaultSave(url, attachment.contentType);
};

const trySaveAsVaultNativeCopy = async (attachment: Attachment): Promise<string | null> => {
    const bytes = await resolveAttachmentBytesForVaultSave(attachment);
    if (!bytes || bytes.byteLength === 0) {
        return null;
    }
    const fileName = attachment.fileName?.trim() || "attachment";
    const contentType = attachment.contentType?.trim() || "application/octet-stream";
    const file = new File([new Uint8Array(bytes)], fileName, { type: contentType });
    const saved = await saveFileToLocalVault(file);
    return saved?.vaultUrl ?? null;
};

export const isChatAttachmentSavedToLocalVault = async (remoteUrl: string): Promise<boolean> => {
    if (!hasNativeRuntime()) {
        return false;
    }
    return Boolean(await resolveLocalMediaUrl(remoteUrl.trim()));
};

const ensureVaultEncryptionForSave = async (): Promise<"ready" | "unlock_required"> => {
    if (isVaultEncryptionSessionReady()) {
        return "ready";
    }
    const { restoreNativeVaultEncryptionSessionIfNeeded } = await import(
        "@/app/features/storage/services/native-storage-at-rest-service"
    );
    await restoreNativeVaultEncryptionSessionIfNeeded();
    return isVaultEncryptionSessionReady() ? "ready" : "unlock_required";
};

export const saveChatAttachmentAndAwaitVaultRow = async (
    attachment: Attachment,
    t: TranslateFn,
    options?: Readonly<{ toastPolicy?: "all" | "errors-only"; suppressUnlockToast?: boolean }>,
): Promise<boolean> => {
    const outcome = await saveChatAttachmentWithOutcome(attachment, t, options);
    return outcome.status === "saved";
};

export const saveChatAttachmentWithOutcome = async (
    attachment: Attachment,
    t: TranslateFn,
    options?: Readonly<{ toastPolicy?: "all" | "errors-only"; suppressUnlockToast?: boolean }>,
): Promise<SaveChatAttachmentOutcome> => {
    const showSuccessToast = options?.toastPolicy !== "errors-only";
    if (!isVaultSaveFromChatFeatureEnabled()) {
        toast.error(t("vault.saveFromChatUnavailable"));
        return { status: "failed", reason: "unavailable" };
    }
    if (!hasNativeRuntime()) {
        toast.error(t("vault.saveFromChatUnavailable"));
        return { status: "failed", reason: "unavailable" };
    }

    const encryption = await ensureVaultEncryptionForSave();
    if (encryption === "unlock_required") {
        if (!options?.suppressUnlockToast) {
            toast.error(t("vault.localSaveUnlockRequired"));
        }
        return { status: "unlock_required" };
    }

    if (isLocalVaultOnlyUrl(attachment.url)) {
        toast.info(t("vault.saveFromChatLocalVaultOnly"));
        return { status: "failed", reason: "already_local" };
    }

    const urlClass = classifyAttachmentFetchUrlForVaultSave(attachment.url);
    if (urlClass === "blocked_host") {
        toast.error(t("vault.saveFromChatBlockedHost"));
        return { status: "failed", reason: "blocked_host" };
    }

    let indexKey: string | null = null;
    try {
        indexKey = await trySaveAsVaultNativeCopy(attachment);
        if (!indexKey) {
            const normalizedUrl = normalizeAttachmentUrl(attachment.url);
            const previewBytes = await fetchPreviewBytes(attachment.url);
            if (previewBytes) {
                const fileName = attachment.fileName?.trim() || "attachment";
                const contentType = attachment.contentType?.trim() || "application/octet-stream";
                const file = new File([new Uint8Array(previewBytes)], fileName, { type: contentType });
                const saved = await saveFileToLocalVault(file);
                indexKey = saved?.vaultUrl ?? null;
            } else if (urlClass === "unsupported" || !normalizedUrl) {
                toast.error(t("vault.saveFromChatUnsupportedUrl"));
                return { status: "failed", reason: "unsupported_url" };
            } else {
                const localUrl = await persistAttachmentToLocalVault(attachment);
                if (!localUrl) {
                    toast.error(t("vault.saveFromChatFailed"));
                    return { status: "failed", reason: "persist_failed" };
                }
                indexKey = normalizedUrl;
            }
        }
    } catch (error) {
        if (error instanceof VaultWriteEncryptionRequiredError) {
            if (!options?.suppressUnlockToast) {
                toast.error(t("vault.localSaveUnlockRequired"));
            }
            return { status: "unlock_required" };
        }
        toast.error(t("vault.saveFromChatFailed"));
        return { status: "failed", reason: "exception" };
    }

    if (!indexKey) {
        toast.error(t("vault.saveFromChatFailed"));
        return { status: "failed", reason: "no_index_key" };
    }

    await hydrateVaultDiskInventoryForActiveProfile().catch(() => undefined);
    const rowVisible = await awaitVaultIndexRowForKey({ indexKey });
    if (!rowVisible) {
        toast.error(t("vault.saveFromChatFailed"));
        return { status: "failed", reason: "index_timeout" };
    }
    if (showSuccessToast) {
        toast.success(t("vault.saveFromChatSuccess"));
    }
    return { status: "saved" };
};

export const saveChatAttachmentToLocalVault = async (
    attachment: Attachment,
    t: TranslateFn,
): Promise<boolean> => saveChatAttachmentAndAwaitVaultRow(attachment, t);

export const saveChatAttachmentsToLocalVault = async (
    attachments: ReadonlyArray<Attachment>,
    t: TranslateFn,
): Promise<number> => {
    if (!isVaultSaveFromChatFeatureEnabled() || !hasNativeRuntime() || attachments.length === 0) {
        return 0;
    }
    let savedCount = 0;
    for (const attachment of attachments) {
        const saved = await saveChatAttachmentAndAwaitVaultRow(attachment, t, { toastPolicy: "errors-only" });
        if (saved) {
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
