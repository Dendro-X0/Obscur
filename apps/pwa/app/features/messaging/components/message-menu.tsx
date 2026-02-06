
import React from "react";
import { cn } from "../../../lib/cn";
import { useTranslation } from "react-i18next";
import type { Message, ReactionEmoji } from "../types";

// Helper to determine if deletable - logic from page.tsx
const isDeletableMessageId = (messageId: string): boolean => {
    void messageId;
    return true;
};

interface MessageMenuProps {
    x: number;
    y: number;
    activeMessage: Message;
    onCopyText: () => void;
    onCopyAttachmentUrl: () => void;
    onReply: () => void;
    onDelete: () => void;
    menuRef: React.RefObject<HTMLDivElement | null>;
}

export function MessageMenu({ x, y, activeMessage, onCopyText, onCopyAttachmentUrl, onReply, onDelete, menuRef }: MessageMenuProps) {
    const { t } = useTranslation();
    const canDelete: boolean = isDeletableMessageId(activeMessage.id);
    const hasText: boolean = Boolean(activeMessage.content.trim());
    const hasAttachment: boolean = Boolean(activeMessage.attachments && activeMessage.attachments.length > 0);

    return (
        <div
            ref={menuRef}
            className="fixed z-50"
            style={{ left: x, top: y }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="w-56 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-950">
                <button
                    type="button"
                    className={cn("w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5", !hasText ? "opacity-50" : "")}
                    disabled={!hasText}
                    onClick={onCopyText}
                >
                    {t("common.copyText")}
                </button>
                <button
                    type="button"
                    className={cn("w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5", !hasAttachment ? "opacity-50" : "")}
                    disabled={!hasAttachment}
                    onClick={onCopyAttachmentUrl}
                >
                    {t("common.copyAttachmentUrl")}
                </button>
                <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                    onClick={onReply}
                >
                    {t("common.reply")}
                </button>
                <button
                    type="button"
                    className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5",
                        !canDelete ? "opacity-50" : "text-red-600 dark:text-red-400"
                    )}
                    disabled={!canDelete}
                    onClick={onDelete}
                >
                    {t("common.delete")}
                </button>
            </div>
        </div>
    );
}
