"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink, HardDrive } from "lucide-react";
import type { Attachment } from "../types";
import { cn } from "@/app/lib/utils";
import {
    canSaveChatAttachmentsToLocalVault,
    saveChatAttachmentToLocalVault,
} from "@/app/features/vault/services/save-chat-attachment-to-vault";

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
    const canSaveToVault = canSaveChatAttachmentsToLocalVault();

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
            onClose();
        };
        window.addEventListener("pointerdown", onPointerDown, true);
        return () => window.removeEventListener("pointerdown", onPointerDown, true);
    }, [onClose, state]);

    React.useEffect(() => {
        if (!state) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose, state]);

    if (!portalRoot || !state) {
        return null;
    }

    const itemClass = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5";

    return createPortal(
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
                    disabled={isSaving}
                    onClick={() => {
                        if (isSaving) {
                            return;
                        }
                        setIsSaving(true);
                        void (async () => {
                            try {
                                const saved = await saveChatAttachmentToLocalVault(state.attachment, t);
                                if (saved) {
                                    setIsSavedToVault(true);
                                }
                            } finally {
                                setIsSaving(false);
                                onClose();
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
        </div>,
        portalRoot,
    );
}
