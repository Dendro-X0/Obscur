import React from "react";
import { createPortal } from "react-dom";
import type { ReactionEmoji } from "../types";

const REACTION_VARIANTS: ReadonlyArray<ReactionEmoji> = [
    "\u{1F44D}",
    "\u{2764}\u{FE0F}",
    "\u{1F602}",
    "\u{1F525}",
    "\u{1F44F}",
];
const VIEWPORT_MARGIN_PX = 8;
const PICKER_GAP_PX = 8;
const DEFAULT_PICKER_WIDTH_PX = 220;
const DEFAULT_PICKER_HEIGHT_PX = 56;

interface ReactionPickerProps {
    messageId: string;
    isOutgoing: boolean;
    x: number;
    y: number;
    onSelect: (emoji: ReactionEmoji) => void;
    pickerRef: React.RefObject<HTMLDivElement | null>;
    onRequestClose?: () => void;
}

export function ReactionPicker({ messageId, isOutgoing, x, y, onSelect, pickerRef, onRequestClose }: ReactionPickerProps) {
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
            return { left: x, top: y };
        }
        const panel = pickerRef.current;
        const rect = panel?.getBoundingClientRect();
        const pickerWidth = Math.max(rect?.width ?? 0, DEFAULT_PICKER_WIDTH_PX);
        const pickerHeight = Math.max(rect?.height ?? 0, DEFAULT_PICKER_HEIGHT_PX);
        const maxLeft = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - pickerWidth - VIEWPORT_MARGIN_PX);
        const maxTop = Math.max(VIEWPORT_MARGIN_PX, window.innerHeight - pickerHeight - VIEWPORT_MARGIN_PX);

        const anchorElement = document.getElementById(`msg-${messageId}`);
        const anchorRect = anchorElement?.getBoundingClientRect();
        if (!anchorRect) {
            const placeRight = !isOutgoing;
            const fallbackLeftRaw = placeRight
                ? (x + PICKER_GAP_PX)
                : (x - pickerWidth - PICKER_GAP_PX);
            const fallbackTopRaw = y - (pickerHeight / 2);
            const fallbackLeft = Math.min(Math.max(fallbackLeftRaw, VIEWPORT_MARGIN_PX), maxLeft);
            const fallbackTop = Math.min(Math.max(fallbackTopRaw, VIEWPORT_MARGIN_PX), maxTop);
            return { left: Math.round(fallbackLeft), top: Math.round(fallbackTop) };
        }

        const anchorCenterY = anchorRect.top + (anchorRect.height / 2);

        // Direction-first layout contract:
        // - left-side bubbles (incoming) open right
        // - right-side bubbles (outgoing) open left
        const placeRight = !isOutgoing;

        let nextLeft = placeRight
            ? (anchorRect.right + PICKER_GAP_PX)
            : (anchorRect.left - pickerWidth - PICKER_GAP_PX);
        let nextTop = anchorCenterY - (pickerHeight / 2);

        nextLeft = Math.min(Math.max(nextLeft, VIEWPORT_MARGIN_PX), maxLeft);
        nextTop = Math.min(Math.max(nextTop, VIEWPORT_MARGIN_PX), maxTop);

        return { left: Math.round(nextLeft), top: Math.round(nextTop) };
    }, [isOutgoing, messageId, pickerRef, x, y]);

    React.useLayoutEffect(() => {
        const next = resolvePosition();
        setPosition(next);
    }, [resolvePosition]);

    React.useEffect(() => {
        const syncPosition = (): void => {
            const anchorElement = document.getElementById(`msg-${messageId}`);
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
    }, [messageId, onRequestClose, resolvePosition]);

    if (!portalRoot) {
        return null;
    }

    return createPortal(
        <div
            ref={pickerRef}
            className="fixed z-[1200]"
            style={{ left: position.left, top: position.top }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="flex gap-1 rounded-xl border border-black/10 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-zinc-950">
                {REACTION_VARIANTS.map((emoji) => (
                    <button
                        key={emoji}
                        type="button"
                        className="rounded-lg px-2 py-1 text-2xl transition-transform hover:scale-125 hover:bg-black/5 active:scale-95 dark:hover:bg-white/5"
                        onClick={() => onSelect(emoji)}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>,
        portalRoot
    );
}
