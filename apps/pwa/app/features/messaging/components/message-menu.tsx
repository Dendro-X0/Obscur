
import React from "react";
import { cn } from "../../../lib/cn";
import { useTranslation } from "react-i18next";
import type { Message } from "../types";

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
    onHoverChange?: (isHovered: boolean) => void;
}

const VIEWPORT_MARGIN_PX = 8;
const MENU_GAP_PX = 8;

export function MessageMenu({
    x,
    y,
    activeMessage,
    onCopyText,
    onCopyAttachmentUrl,
    onReply,
    onDelete,
    menuRef,
    onHoverChange,
}: MessageMenuProps) {
    const { t } = useTranslation();
    const canDelete: boolean = isDeletableMessageId(activeMessage.id);
    const hasText: boolean = Boolean(activeMessage.content.trim());
    const hasAttachment: boolean = Boolean(activeMessage.attachments && activeMessage.attachments.length > 0);
    const [position, setPosition] = React.useState<Readonly<{ left: number; top: number }>>({
        left: x,
        top: y,
    });

    React.useLayoutEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const panel = menuRef.current;
        if (!panel) {
            setPosition({ left: x, top: y });
            return;
        }

        const rect = panel.getBoundingClientRect();
        const menuWidth = Math.max(rect.width, 224);
        const menuHeight = Math.max(rect.height, 180);

        const maxLeft = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - menuWidth - VIEWPORT_MARGIN_PX);
        const maxTop = Math.max(VIEWPORT_MARGIN_PX, window.innerHeight - menuHeight - VIEWPORT_MARGIN_PX);

        let nextLeft = x + MENU_GAP_PX;
        let nextTop = y + MENU_GAP_PX;

        if (nextLeft > maxLeft) {
            nextLeft = x - menuWidth - MENU_GAP_PX;
        }
        if (nextTop > maxTop) {
            nextTop = y - menuHeight - MENU_GAP_PX;
        }

        nextLeft = Math.min(Math.max(nextLeft, VIEWPORT_MARGIN_PX), maxLeft);
        nextTop = Math.min(Math.max(nextTop, VIEWPORT_MARGIN_PX), maxTop);

        setPosition({ left: Math.round(nextLeft), top: Math.round(nextTop) });
    }, [menuRef, x, y]);

    return (
        <div
            ref={menuRef}
            className="fixed z-[1200]"
            style={{ left: position.left, top: position.top }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerEnter={() => onHoverChange?.(true)}
            onPointerLeave={() => onHoverChange?.(false)}
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
