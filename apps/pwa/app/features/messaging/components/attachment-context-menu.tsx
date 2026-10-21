"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Copy, Download, ExternalLink, HardDrive } from "lucide-react";
import { toast } from "@dweb/ui-kit/toast";
import type { Attachment } from "../types";
import { cn } from "@/app/lib/utils";
import { requiresAttachmentExportConfirm } from "@/app/features/dm-kernel/dm-kernel-trust-export-action-gate";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
    canSaveChatAttachmentsToLocalVault,
    saveChatAttachmentWithOutcome,
} from "@/app/features/vault/services/save-chat-attachment-to-vault";
import { downloadAttachmentToUserPath } from "@/app/features/vault/services/local-media-store";
import { AttachmentExportConfirmDialog } from "@/app/features/security/components/attachment-export-confirm-dialog";
import { VaultWriteUnlockDialog } from "@/app/features/security/components/vault-write-unlock-dialog";

export type AttachmentContextMenuState = Readonly<{
    attachment: Attachment;
    x: number;
    y: number;
}> | null;

type AttachmentContextMenuProps = Readonly<{
    state: AttachmentContextMenuState;
    onClose: () => void;
    onCopyUrl?: (url: string) => void;
    onOpenInNewTab?: (url: string) => void;
}>;

const VIEWPORT_MARGIN_PX = 8;
const MENU_WIDTH_PX = 240;

export function AttachmentContextMenu({ state, onClose, onCopyUrl, onOpenInNewTab }: AttachmentContextMenuProps) {
    const { t } = useTranslation();
    const menuRef = React.useRef<HTMLDivElement | null>(null);
    const [portalRoot, setPortalRoot] = React.useState<HTMLElement | null>(null);
    const [position, setPosition] = React.useState<Readonly<{ left: number; top: number }>>({ left: 0, top: 0 });
    const [isSavedToVault, setIsSavedToVault] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isDownloading, setIsDownloading] = React.useState(false);
    const [showVaultUnlock, setShowVaultUnlock] = React.useState(false);
    const [pendingUnlockAttachment, setPendingUnlockAttachment] = React.useState<Attachment | null>(null);
    const [pendingDownloadFileName, setPendingDownloadFileName] = React.useState<string | null>(null);
    const pendingDownloadAttachmentRef = React.useRef<Attachment | null>(null);
    const canSaveToVault = canSaveChatAttachmentsToLocalVault();

    const runDownloadToFolder = React.useCallback(async (attachment: Attachment): Promise<void> => {
        setIsDownloading(true);
        try {
            const result = await downloadAttachmentToUserPath({ attachment });
            if (result === "cancelled") {
                onClose();
                return;
            }
            if (result !== "saved") {
                toast.error(t("vault.downloadToFolderFailed"));
                return;
            }
            toast.success(t("vault.exportDecryptedCopySuccess"));
            onClose();
        } finally {
            setIsDownloading(false);
        }
    }, [onClose, t]);

    const requestDownloadToFolder = React.useCallback((attachment: Attachment): void => {
        if (isDownloading) {
            return;
        }
        const needsConfirm = requiresAttachmentExportConfirm({
            peerPublicKeyHex: "",
            isPeerAccepted: true,
            attachmentFileName: attachment.fileName ?? "attachment",
            messageTimestampUnixMs: Date.now(),
            threadFirstPeerMessageAtUnixMs: null,
            profileId: getResolvedProfileId(),
        });
        if (needsConfirm) {
            pendingDownloadAttachmentRef.current = attachment;
            setPendingDownloadFileName(attachment.fileName?.trim() || t("common.file"));
            return;
        }
        void runDownloadToFolder(attachment);
    }, [isDownloading, runDownloadToFolder, t]);

    React.useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }
        setPortalRoot(document.body);
    }, []);

    React.useLayoutEffect(() => {
        if (!state || typeof window === "undefined") {
            return;
        }
        const menuHeight = Math.max(menuRef.current?.getBoundingClientRect().height ?? 0, 160);
        const maxLeft = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - MENU_WIDTH_PX - VIEWPORT_MARGIN_PX);
        const maxTop = Math.max(VIEWPORT_MARGIN_PX, window.innerHeight - menuHeight - VIEWPORT_MARGIN_PX);
        setPosition({
            left: Math.round(Math.min(Math.max(state.x, VIEWPORT_MARGIN_PX), maxLeft)),
            top: Math.round(Math.min(Math.max(state.y, VIEWPORT_MARGIN_PX), maxTop)),
        });
    }, [state]);

    React.useEffect(() => {
        if (!state) {
            return;
        }
        const onPointerDown = (event: PointerEvent): void => {
            if (menuRef.current?.contains(event.target as Node)) {
                return;
            }
            if (showVaultUnlock || pendingDownloadFileName) {
                return;
            }
            onClose();
        };
        window.addEventListener("pointerdown", onPointerDown, true);
        return () => window.removeEventListener("pointerdown", onPointerDown, true);
    }, [onClose, pendingDownloadFileName, showVaultUnlock, state]);

    React.useEffect(() => {
        if (!state) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                if (showVaultUnlock) {
                    setShowVaultUnlock(false);
                    setPendingUnlockAttachment(null);
                    return;
                }
                if (pendingDownloadFileName) {
                    pendingDownloadAttachmentRef.current = null;
                    setPendingDownloadFileName(null);
                    return;
                }
                onClose();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose, pendingDownloadFileName, showVaultUnlock, state]);

    const retrySaveAfterUnlock = async (): Promise<void> => {
        const attachment = pendingUnlockAttachment;
        setShowVaultUnlock(false);
        setPendingUnlockAttachment(null);
        if (!attachment) {
            return;
        }
        setIsSaving(true);
        try {
            const outcome = await saveChatAttachmentWithOutcome(attachment, t);
            if (outcome.status === "saved") {
                setIsSavedToVault(true);
            }
        } finally {
            setIsSaving(false);
            onClose();
        }
    };

    if (!portalRoot || !state) {
        return null;
    }

    const itemClass = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5";

    return createPortal(
        <>
            <VaultWriteUnlockDialog
                isOpen={showVaultUnlock}
                onClose={() => {
                    setShowVaultUnlock(false);
                    setPendingUnlockAttachment(null);
                    onClose();
                }}
                onUnlocked={() => { void retrySaveAfterUnlock(); }}
            />
            <AttachmentExportConfirmDialog
                fileName={pendingDownloadFileName}
                onClose={() => {
                    pendingDownloadAttachmentRef.current = null;
                    setPendingDownloadFileName(null);
                }}
                onConfirm={() => {
                    const attachment = pendingDownloadAttachmentRef.current;
                    pendingDownloadAttachmentRef.current = null;
                    setPendingDownloadFileName(null);
                    if (attachment) {
                        void runDownloadToFolder(attachment);
                    }
                }}
            />
            {pendingDownloadFileName ? null : (
            <div
                ref={menuRef}
                data-escape-layer="open"
                data-testid="attachment-context-menu"
                className="fixed z-[1300] w-60 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-950"
                style={{ left: position.left, top: position.top }}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <div className="border-b border-black/5 px-3 py-2 dark:border-white/10">
                    <p className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {state.attachment.fileName || t("common.file")}
                    </p>
                </div>
                {canSaveToVault ? (<button
                        type="button"
                        className={cn(itemClass, isSaving && "opacity-50")}
                        disabled={isSaving || isDownloading}
                        onClick={() => {
                            if (isSaving || isDownloading) {
                                return;
                            }
                            setIsSaving(true);
                            void (async () => {
                                try {
                                    const outcome = await saveChatAttachmentWithOutcome(state.attachment, t, {
                                        suppressUnlockToast: true,
                                    });
                                    if (outcome.status === "saved") {
                                        setIsSavedToVault(true);
                                        onClose();
                                    } else if (outcome.status === "unlock_required") {
                                        setPendingUnlockAttachment(state.attachment);
                                        setShowVaultUnlock(true);
                                    } else {
                                        onClose();
                                    }
                                } finally {
                                    setIsSaving(false);
                                }
                            })();
                        }}
                    >
                        <HardDrive className="h-3.5 w-3.5"/>
                        {isSavedToVault ? t("vault.alreadyInVault") : t("vault.saveFromChat")}
                    </button>
                ) : null}
                <button
                    type="button"
                    className={cn(itemClass, isDownloading && "opacity-50")}
                    disabled={isSaving || isDownloading}
                    data-testid="attachment-download-to-folder"
                    onClick={() => {
                        requestDownloadToFolder(state.attachment);
                    }}
                >
                    <Download className="h-3.5 w-3.5"/>
                    {t("vault.downloadToFolder")}
                </button>
                <button
                    type="button"
                    className={itemClass}
                    onClick={async () => {
                        if (onCopyUrl) {
                            onCopyUrl(state.attachment.url);
                        } else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                            await navigator.clipboard.writeText(state.attachment.url);
                        }
                        onClose();
                    }}
                >
                    <Copy className="h-3.5 w-3.5"/>
                    {t("common.copyAttachmentUrl")}
                </button>
                <button
                    type="button"
                    className={itemClass}
                    onClick={() => {
                        if (onOpenInNewTab) {
                            onOpenInNewTab(state.attachment.url);
                        } else {
                            window.open(state.attachment.url, "_blank", "noopener,noreferrer");
                        }
                        onClose();
                    }}
                >
                    <ExternalLink className="h-3.5 w-3.5"/>
                    {t("common.openInNewTab")}
                </button>
            </div>
            )}
        </>,
        portalRoot,
    );
}
