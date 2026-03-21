
import React from "react";
import { createPortal } from "react-dom";
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
    onRequestClose?: () => void;
}

const VIEWPORT_MARGIN_PX = 8;
const MENU_GAP_PX = 8;
const DEFAULT_MENU_WIDTH_PX = 224;
const DEFAULT_MENU_HEIGHT_PX = 180;

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
    onRequestClose,
}: MessageMenuProps) {
    const { t } = useTranslation();
    const canDelete: boolean = isDeletableMessageId(activeMessage.id);
    const hasText: boolean = Boolean(activeMessage.content.trim());
    const hasAttachment: boolean = Boolean(activeMessage.attachments && activeMessage.attachments.length > 0);
    const [portalRoot, setPortalRoot] = React.useState<HTMLElement | null>(null);
    const [position, setPosition] = React.useState<Readonly<{ left: number; top: number }>>({
        left: x,
        top: y,
    });

    React.useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }
        setPortalRoot(document.body);
    }, []);

    const resolvePosition = React.useCallback((): Readonly<{ left: number; top: number }> => {
        if (typeof window === "undefined") {
            return {
                left: x,
                top: y,
            };
        }
        const panel = menuRef.current;
        const rect = panel?.getBoundingClientRect();
        const menuWidth = Math.max(rect?.width ?? 0, DEFAULT_MENU_WIDTH_PX);
        const menuHeight = Math.max(rect?.height ?? 0, DEFAULT_MENU_HEIGHT_PX);

        const maxLeft = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - menuWidth - VIEWPORT_MARGIN_PX);
        const maxTop = Math.max(VIEWPORT_MARGIN_PX, window.innerHeight - menuHeight - VIEWPORT_MARGIN_PX);

        const anchorElement = document.getElementById(`msg-${activeMessage.id}`);
        const anchorRect = anchorElement?.getBoundingClientRect();
        if (!anchorRect) {
            const placeRight = !activeMessage.isOutgoing;
            const fallbackLeftRaw = placeRight
                ? (x + MENU_GAP_PX)
                : (x - menuWidth - MENU_GAP_PX);
            const fallbackTopRaw = y - (menuHeight / 2);
            const fallbackLeft = Math.min(Math.max(fallbackLeftRaw, VIEWPORT_MARGIN_PX), maxLeft);
            const fallbackTop = Math.min(Math.max(fallbackTopRaw, VIEWPORT_MARGIN_PX), maxTop);
            return { left: Math.round(fallbackLeft), top: Math.round(fallbackTop) };
        }

        const anchorCenterY = anchorRect.top + (anchorRect.height / 2);

        // Direction-first layout contract:
        // - left-side bubbles (incoming) open right
        // - right-side bubbles (outgoing) open left
        const placeRight = !activeMessage.isOutgoing;

        let nextLeft = placeRight
            ? (anchorRect.right + MENU_GAP_PX)
            : (anchorRect.left - menuWidth - MENU_GAP_PX);
        let nextTop = anchorCenterY - (menuHeight / 2);

        nextLeft = Math.min(Math.max(nextLeft, VIEWPORT_MARGIN_PX), maxLeft);
        nextTop = Math.min(Math.max(nextTop, VIEWPORT_MARGIN_PX), maxTop);

        return { left: Math.round(nextLeft), top: Math.round(nextTop) };
    }, [activeMessage.id, activeMessage.isOutgoing, menuRef, x, y]);

    React.useLayoutEffect(() => {
        const next = resolvePosition();
        setPosition(next);
    }, [resolvePosition]);

    React.useEffect(() => {
        const syncPosition = (): void => {
            const anchorElement = document.getElementById(`msg-${activeMessage.id}`);
            if (!anchorElement) {
                onRequestClose?.();
                return;
            }
            const next = resolvePosition();
            setPosition((prev) => (
                prev.left === next.left && prev.top === next.top
                    ? prev
                    : next
            ));
        };
        window.addEventListener("resize", syncPosition);
        window.addEventListener("scroll", syncPosition, true);
        return () => {
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
        };
    }, [activeMessage.id, onRequestClose, resolvePosition]);

    if (!portalRoot) {
        return null;
    }

    return createPortal(
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
        </div>,
        portalRoot
    );
}
